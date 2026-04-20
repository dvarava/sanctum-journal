package main

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	_ "github.com/mattn/go-sqlite3"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/argon2"
)

type App struct {
	ctx         context.Context
	db          *sql.DB
	dbPath      string
	sanctumDir  string
	keyMu       sync.RWMutex
	secretKey   []byte
	embedText   func(string) []float64
	pullMu      sync.Mutex
	pullCancels map[string]context.CancelFunc
}

func NewApp() *App {
	return &App{
		pullCancels: make(map[string]context.CancelFunc),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.initDB()
}

type Entry struct {
	ID        int      `json:"id"`
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	Preview   string   `json:"preview"`
	Emotions  []string `json:"emotions"`
	Coaching  string   `json:"coaching"`
	CreatedAt string   `json:"created_at"`
}

type Settings struct {
	CoachingStyle      string `json:"coaching_style"` // compassionate, direct, socratic, motivational
	AnalysisDepth      string `json:"analysis_depth"` // brief, detailed
	ModelName          string `json:"model_name"`     // ollama model to use
	EmotionModel       string `json:"emotion_model"`  // ollama model to use for emotion analysis
	UserName           string `json:"user_name"`      // for personalised greeting
	CrisisRegion       string `json:"crisis_region"`  // global, us, uk_ie
	OnboardingComplete bool   `json:"onboarding_complete"`
}

type VaultStatus struct {
	Configured bool `json:"configured"`
	Unlocked   bool `json:"unlocked"`
}

type AuthResult struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Status  VaultStatus `json:"status"`
}

type AnalysisAuditEvent struct {
	ID             int    `json:"id"`
	CreatedAt      string `json:"created_at"`
	EntryID        int    `json:"entry_id"`
	Mode           string `json:"mode"`
	ModelName      string `json:"model_name"`
	EmotionModel   string `json:"emotion_model"`
	DataLeftDevice bool   `json:"data_left_device"`
	CrisisDetected bool   `json:"crisis_detected"`
	Purpose        string `json:"purpose"`
}

type encryptedEntryPayload struct {
	Version   int       `json:"version"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Emotions  []string  `json:"emotions"`
	Coaching  string    `json:"coaching"`
	Embedding []float64 `json:"embedding"`
}

type vaultRecord struct {
	KDF        string
	Salt       []byte
	TimeCost   uint32
	MemoryCost uint32
	Threads    uint8
	KeyLength  uint32
	Verifier   []byte
}

type sqlExecutor interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

const (
	defaultEmotionModel = "default"
	defaultCrisisRegion = "global"

	vaultKDF               = "argon2id"
	vaultPasswordMinLength = 10
	vaultSaltLength        = 32
	vaultKeyLength         = 32
	vaultArgonTime         = uint32(3)
	vaultArgonMemory       = uint32(64 * 1024)
	vaultArgonThreads      = uint8(4)
	vaultVerifierPlaintext = "sanctum-vault-verifier-v1"

	entryPayloadVersion = 1
)

var encryptedBlobMagic = []byte{'S', 'J', '1'}

var ollamaModelAliases = map[string]string{
	"emollm:7b":     "guanxin/emollm:latest",
	"emollm:latest": "guanxin/emollm:latest",
}

var (
	emotionWhitespacePattern = regexp.MustCompile(`\s+`)
	emotionHyphenPattern     = regexp.MustCompile(`\s*-\s*`)
)

func canonicalOllamaModelName(modelName string) string {
	modelName = strings.TrimSpace(modelName)
	if alias, ok := ollamaModelAliases[strings.ToLower(modelName)]; ok {
		return alias
	}
	return modelName
}

func canonicalEmotionModelName(modelName string) string {
	modelName = canonicalOllamaModelName(modelName)
	if modelName == "" {
		return defaultEmotionModel
	}
	return modelName
}

func normalizeCrisisRegion(region string) string {
	switch strings.ToLower(strings.TrimSpace(region)) {
	case "us", "usa", "united_states", "united-states":
		return "us"
	case "uk_ie", "uk-ie", "uk/ie", "uk", "ie", "ireland":
		return "uk_ie"
	case "global", "":
		return defaultCrisisRegion
	default:
		return defaultCrisisRegion
	}
}

func defaultSettings() Settings {
	return Settings{
		CoachingStyle:      "compassionate",
		AnalysisDepth:      "brief",
		ModelName:          "qwen3:4b",
		EmotionModel:       defaultEmotionModel,
		CrisisRegion:       defaultCrisisRegion,
		OnboardingComplete: false,
	}
}

func friendlyPullModelError(requestedModel, actualModel, errMessage string) string {
	normalized := strings.ToLower(errMessage)
	if strings.Contains(normalized, "pull model manifest") && strings.Contains(normalized, "file does not exist") {
		if requestedModel != actualModel {
			return fmt.Sprintf("The saved model name %s is outdated. I tried %s, but Ollama could not find its manifest. Check the model name in Ollama and try again.", requestedModel, actualModel)
		}
		return fmt.Sprintf("Ollama could not find %s. Check that the model name and tag exist in Ollama, then try again.", requestedModel)
	}
	return errMessage
}

func normalizeEmotionWord(word string) string {
	word = strings.TrimSpace(word)
	if word == "" {
		return ""
	}

	word = strings.ToLower(word)
	first, size := utf8.DecodeRuneInString(word)
	return string(unicode.ToUpper(first)) + word[size:]
}

func normalizeEmotionToken(token string) string {
	parts := strings.Split(token, "-")
	normalized := make([]string, 0, len(parts))
	for _, part := range parts {
		part = normalizeEmotionWord(part)
		if part != "" {
			normalized = append(normalized, part)
		}
	}
	return strings.Join(normalized, "-")
}

func normalizeEmotionLabel(label string) string {
	label = strings.TrimSpace(strings.ReplaceAll(label, "_", " "))
	label = emotionHyphenPattern.ReplaceAllString(label, "-")
	label = emotionWhitespacePattern.ReplaceAllString(label, " ")
	if label == "" {
		return ""
	}

	tokens := strings.Fields(label)
	for i, token := range tokens {
		tokens[i] = normalizeEmotionToken(token)
	}
	return strings.Join(tokens, " ")
}

func emotionDedupKey(label string) string {
	return strings.NewReplacer(" ", "", "-", "").Replace(strings.ToLower(label))
}

func normalizeEmotions(emotions []string) []string {
	normalized := make([]string, 0, len(emotions))
	seen := make(map[string]bool)

	for _, emotion := range emotions {
		label := normalizeEmotionLabel(emotion)
		if label == "" {
			continue
		}

		key := emotionDedupKey(label)
		if seen[key] {
			continue
		}

		seen[key] = true
		normalized = append(normalized, label)
		if len(normalized) == 3 {
			break
		}
	}

	return normalized
}

// initialize the local SQLite database
func (a *App) initDB() {
	appDataDir, _ := os.UserConfigDir()

	// dedicated Sanctum directory
	sanctumDir := filepath.Join(appDataDir, "Sanctum")
	if err := os.MkdirAll(sanctumDir, 0755); err != nil {
		fmt.Println("Error creating directory:", err)
		return
	}
	a.sanctumDir = sanctumDir

	dbPath := filepath.Join(sanctumDir, "sanctum_proto.db")
	a.dbPath = dbPath

	var err error
	a.db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Println("Error opening DB:", err)
		return
	}

	if err := a.ensureDatabaseSchema(); err != nil {
		fmt.Println("Error initializing database schema:", err)
		return
	}

	fmt.Println("Database initialized at:", dbPath)
}

func (a *App) ensureDatabaseSchema() error {
	if a.db == nil {
		return errors.New("database not initialized")
	}

	_, err := a.db.Exec(`CREATE TABLE IF NOT EXISTS entries (
		id INTEGER PRIMARY KEY,
		payload BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`)
	if err != nil {
		return fmt.Errorf("creating entries table: %w", err)
	}

	// settings table
	_, err = a.db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		coaching_style TEXT DEFAULT 'compassionate',
		analysis_depth TEXT DEFAULT 'brief',
		model_name TEXT DEFAULT 'qwen3:4b',
		emotion_model TEXT DEFAULT 'default',
		user_name TEXT DEFAULT '',
		crisis_region TEXT DEFAULT 'global',
		onboarding_complete BOOLEAN DEFAULT 0
	);`)
	if err != nil {
		return fmt.Errorf("creating settings table: %w", err)
	}
	// ensure defaults row exists
	_, _ = a.db.Exec(`INSERT OR IGNORE INTO settings (id) VALUES (1);`)

	// migrations for existing DBs
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN user_name TEXT DEFAULT '';")
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN onboarding_complete BOOLEAN DEFAULT 0;")
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN emotion_model TEXT DEFAULT 'default';")
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN crisis_region TEXT DEFAULT 'global';")

	_, err = a.db.Exec(`CREATE TABLE IF NOT EXISTS vault (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		kdf TEXT NOT NULL,
		salt BLOB NOT NULL,
		time_cost INTEGER NOT NULL,
		memory_cost INTEGER NOT NULL,
		threads INTEGER NOT NULL,
		key_length INTEGER NOT NULL,
		verifier BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`)
	if err != nil {
		return fmt.Errorf("creating vault table: %w", err)
	}

	_, err = a.db.Exec(`CREATE TABLE IF NOT EXISTS analysis_audit (
		id INTEGER PRIMARY KEY,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		entry_id INTEGER NOT NULL DEFAULT 0,
		mode TEXT NOT NULL,
		model_name TEXT NOT NULL,
		emotion_model TEXT DEFAULT '',
		data_left_device BOOLEAN NOT NULL DEFAULT 0,
		crisis_detected BOOLEAN NOT NULL DEFAULT 0,
		purpose TEXT NOT NULL DEFAULT 'journal_analysis'
	);`)
	if err != nil {
		return fmt.Errorf("creating analysis audit table: %w", err)
	}

	return nil
}

func recreateEncryptedEntriesTable(exec sqlExecutor) error {
	if _, err := exec.Exec("DROP TABLE IF EXISTS entries;"); err != nil {
		return err
	}
	_, err := exec.Exec(`CREATE TABLE entries (
		id INTEGER PRIMARY KEY,
		payload BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`)
	return err
}

func randomBytes(length int) ([]byte, error) {
	buf := make([]byte, length)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func validateNewPassword(password, confirm string) error {
	if password != confirm {
		return errors.New("passwords do not match")
	}
	if len([]rune(password)) < vaultPasswordMinLength {
		return fmt.Errorf("password must be at least %d characters", vaultPasswordMinLength)
	}
	return nil
}

func defaultVaultRecord(password string) (vaultRecord, []byte, error) {
	salt, err := randomBytes(vaultSaltLength)
	if err != nil {
		return vaultRecord{}, nil, err
	}

	record := vaultRecord{
		KDF:        vaultKDF,
		Salt:       salt,
		TimeCost:   vaultArgonTime,
		MemoryCost: vaultArgonMemory,
		Threads:    vaultArgonThreads,
		KeyLength:  vaultKeyLength,
	}
	key := deriveVaultKey(password, record)
	verifier, err := encryptBytesWithKey(key, []byte(vaultVerifierPlaintext))
	if err != nil {
		return vaultRecord{}, nil, err
	}
	record.Verifier = verifier
	return record, key, nil
}

func deriveVaultKey(password string, record vaultRecord) []byte {
	return argon2.IDKey([]byte(password), record.Salt, record.TimeCost, record.MemoryCost, record.Threads, record.KeyLength)
}

func (a *App) setSecretKey(key []byte) {
	a.keyMu.Lock()
	defer a.keyMu.Unlock()

	for i := range a.secretKey {
		a.secretKey[i] = 0
	}
	a.secretKey = append([]byte(nil), key...)
}

func (a *App) clearSecretKey() {
	a.keyMu.Lock()
	defer a.keyMu.Unlock()

	for i := range a.secretKey {
		a.secretKey[i] = 0
	}
	a.secretKey = nil
}

func (a *App) currentSecretKey() ([]byte, error) {
	a.keyMu.RLock()
	defer a.keyMu.RUnlock()

	if len(a.secretKey) != vaultKeyLength {
		return nil, errors.New("vault is locked")
	}
	return append([]byte(nil), a.secretKey...), nil
}

func (a *App) isVaultUnlocked() bool {
	a.keyMu.RLock()
	defer a.keyMu.RUnlock()
	return len(a.secretKey) == vaultKeyLength
}

func (a *App) getVaultRecord() (vaultRecord, bool, error) {
	if a.db == nil {
		return vaultRecord{}, false, errors.New("database not initialized")
	}

	var record vaultRecord
	var timeCost, memoryCost, threads, keyLength int
	err := a.db.QueryRow(`
		SELECT kdf, salt, time_cost, memory_cost, threads, key_length, verifier
		FROM vault
		WHERE id = 1
	`).Scan(&record.KDF, &record.Salt, &timeCost, &memoryCost, &threads, &keyLength, &record.Verifier)
	if errors.Is(err, sql.ErrNoRows) {
		return vaultRecord{}, false, nil
	}
	if err != nil {
		return vaultRecord{}, false, err
	}
	if record.KDF != vaultKDF {
		return vaultRecord{}, true, fmt.Errorf("unsupported vault KDF: %s", record.KDF)
	}
	if timeCost <= 0 || memoryCost <= 0 || threads <= 0 || keyLength <= 0 {
		return vaultRecord{}, true, errors.New("vault metadata is invalid")
	}

	record.TimeCost = uint32(timeCost)
	record.MemoryCost = uint32(memoryCost)
	record.Threads = uint8(threads)
	record.KeyLength = uint32(keyLength)
	return record, true, nil
}

func (a *App) vaultStatus() VaultStatus {
	_, configured, err := a.getVaultRecord()
	if err != nil {
		return VaultStatus{Configured: false, Unlocked: false}
	}
	return VaultStatus{Configured: configured, Unlocked: configured && a.isVaultUnlocked()}
}

func (a *App) authResult(success bool, message string) AuthResult {
	return AuthResult{
		Success: success,
		Message: message,
		Status:  a.vaultStatus(),
	}
}

func verifyVaultPassword(password string, record vaultRecord) ([]byte, error) {
	key := deriveVaultKey(password, record)
	plaintext, err := decryptBytesWithKey(key, record.Verifier)
	if err != nil {
		return nil, errors.New("incorrect password")
	}
	if subtle.ConstantTimeCompare(plaintext, []byte(vaultVerifierPlaintext)) != 1 {
		return nil, errors.New("incorrect password")
	}
	return key, nil
}

func insertVaultRecord(exec sqlExecutor, record vaultRecord) error {
	_, err := exec.Exec(`
		INSERT INTO vault (id, kdf, salt, time_cost, memory_cost, threads, key_length, verifier, created_at, updated_at)
		VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			kdf = excluded.kdf,
			salt = excluded.salt,
			time_cost = excluded.time_cost,
			memory_cost = excluded.memory_cost,
			threads = excluded.threads,
			key_length = excluded.key_length,
			verifier = excluded.verifier,
			updated_at = CURRENT_TIMESTAMP
	`, record.KDF, record.Salt, record.TimeCost, record.MemoryCost, record.Threads, record.KeyLength, record.Verifier)
	return err
}

func (a *App) backupDatabase(reason string) (string, error) {
	if a.db == nil || a.dbPath == "" {
		return "", nil
	}

	baseDir := a.sanctumDir
	if baseDir == "" {
		baseDir = filepath.Dir(a.dbPath)
	}
	backupsDir := filepath.Join(baseDir, "backups")
	if err := os.MkdirAll(backupsDir, 0755); err != nil {
		return "", err
	}

	safeReason := strings.NewReplacer(" ", "-", "/", "-", "\\", "-", ":", "-").Replace(strings.ToLower(strings.TrimSpace(reason)))
	if safeReason == "" {
		safeReason = "vault"
	}
	now := time.Now()
	backupName := fmt.Sprintf("sanctum-%s-%09d-%s.db", now.Format("20060102-150405"), now.Nanosecond(), safeReason)
	backupPath := filepath.Join(backupsDir, backupName)

	if _, err := a.db.Exec("VACUUM main INTO ?", backupPath); err == nil {
		return backupPath, nil
	}

	return backupPath, copyFile(a.dbPath, backupPath)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func (a *App) GetVaultStatus() VaultStatus {
	return a.vaultStatus()
}

func (a *App) SetupVaultPassword(password, confirm string) AuthResult {
	if a.db == nil {
		return a.authResult(false, "Database not initialized.")
	}
	if err := validateNewPassword(password, confirm); err != nil {
		return a.authResult(false, err.Error())
	}
	if _, configured, err := a.getVaultRecord(); err != nil {
		return a.authResult(false, "Could not read vault settings: "+err.Error())
	} else if configured {
		return a.authResult(false, "Vault is already set up.")
	}

	if _, err := a.backupDatabase("first-password-setup"); err != nil {
		return a.authResult(false, "Could not archive the current database: "+err.Error())
	}

	record, key, err := defaultVaultRecord(password)
	if err != nil {
		return a.authResult(false, "Could not create vault key: "+err.Error())
	}

	tx, err := a.db.Begin()
	if err != nil {
		return a.authResult(false, "Could not start vault setup: "+err.Error())
	}
	defer tx.Rollback()

	if err := recreateEncryptedEntriesTable(tx); err != nil {
		return a.authResult(false, "Could not reset old journal entries: "+err.Error())
	}
	if err := insertVaultRecord(tx, record); err != nil {
		return a.authResult(false, "Could not save vault settings: "+err.Error())
	}
	if err := tx.Commit(); err != nil {
		return a.authResult(false, "Could not finish vault setup: "+err.Error())
	}

	a.setSecretKey(key)
	return a.authResult(true, "Vault is ready.")
}

func (a *App) UnlockVault(password string) AuthResult {
	a.clearSecretKey()

	record, configured, err := a.getVaultRecord()
	if err != nil {
		return a.authResult(false, "Could not read vault settings: "+err.Error())
	}
	if !configured {
		return a.authResult(false, "Create a password before unlocking Sanctum.")
	}

	key, err := verifyVaultPassword(password, record)
	if err != nil {
		a.clearSecretKey()
		return a.authResult(false, "Incorrect password.")
	}

	a.setSecretKey(key)
	return a.authResult(true, "Vault unlocked.")
}

func (a *App) LockVault() AuthResult {
	a.clearSecretKey()
	return a.authResult(true, "Vault locked.")
}

func (a *App) ResetVault(password, confirm string) AuthResult {
	if a.db == nil {
		return a.authResult(false, "Database not initialized.")
	}
	if err := validateNewPassword(password, confirm); err != nil {
		return a.authResult(false, err.Error())
	}
	if _, err := a.backupDatabase("password-reset"); err != nil {
		return a.authResult(false, "Could not archive the encrypted database: "+err.Error())
	}

	record, key, err := defaultVaultRecord(password)
	if err != nil {
		return a.authResult(false, "Could not create vault key: "+err.Error())
	}

	tx, err := a.db.Begin()
	if err != nil {
		return a.authResult(false, "Could not start reset: "+err.Error())
	}
	defer tx.Rollback()

	if err := recreateEncryptedEntriesTable(tx); err != nil {
		return a.authResult(false, "Could not clear journal entries: "+err.Error())
	}
	if err := insertVaultRecord(tx, record); err != nil {
		return a.authResult(false, "Could not save vault settings: "+err.Error())
	}
	if err := tx.Commit(); err != nil {
		return a.authResult(false, "Could not finish reset: "+err.Error())
	}

	a.setSecretKey(key)
	return a.authResult(true, "Journal reset and unlocked.")
}

type entryCiphertextUpdate struct {
	ID      int
	Payload []byte
}

func (a *App) ChangeVaultPassword(currentPassword, newPassword, confirm string) AuthResult {
	if a.db == nil {
		return a.authResult(false, "Database not initialized.")
	}
	if err := validateNewPassword(newPassword, confirm); err != nil {
		return a.authResult(false, err.Error())
	}

	record, configured, err := a.getVaultRecord()
	if err != nil {
		return a.authResult(false, "Could not read vault settings: "+err.Error())
	}
	if !configured {
		return a.authResult(false, "Create a password before changing it.")
	}

	oldKey, err := verifyVaultPassword(currentPassword, record)
	if err != nil {
		return a.authResult(false, "Current password is incorrect.")
	}

	newRecord, newKey, err := defaultVaultRecord(newPassword)
	if err != nil {
		return a.authResult(false, "Could not create the new vault key: "+err.Error())
	}

	rows, err := a.db.Query("SELECT id, payload FROM entries ORDER BY id ASC")
	if err != nil {
		return a.authResult(false, "Could not read encrypted entries: "+err.Error())
	}

	var updates []entryCiphertextUpdate
	for rows.Next() {
		var update entryCiphertextUpdate
		var oldPayload []byte
		if err := rows.Scan(&update.ID, &oldPayload); err != nil {
			rows.Close()
			return a.authResult(false, "Could not read encrypted entry: "+err.Error())
		}
		plaintext, err := decryptBytesWithKey(oldKey, oldPayload)
		if err != nil {
			rows.Close()
			return a.authResult(false, "Could not decrypt an entry with the current password.")
		}
		update.Payload, err = encryptBytesWithKey(newKey, plaintext)
		if err != nil {
			rows.Close()
			return a.authResult(false, "Could not re-encrypt an entry: "+err.Error())
		}
		updates = append(updates, update)
	}
	if err := rows.Close(); err != nil {
		return a.authResult(false, "Could not finish reading encrypted entries: "+err.Error())
	}
	if err := rows.Err(); err != nil {
		return a.authResult(false, "Could not read encrypted entries: "+err.Error())
	}

	tx, err := a.db.Begin()
	if err != nil {
		return a.authResult(false, "Could not start password change: "+err.Error())
	}
	defer tx.Rollback()

	for _, update := range updates {
		if _, err := tx.Exec("UPDATE entries SET payload = ? WHERE id = ?", update.Payload, update.ID); err != nil {
			return a.authResult(false, "Could not save re-encrypted entries: "+err.Error())
		}
	}
	if err := insertVaultRecord(tx, newRecord); err != nil {
		return a.authResult(false, "Could not save the new vault settings: "+err.Error())
	}
	if err := tx.Commit(); err != nil {
		return a.authResult(false, "Could not finish password change: "+err.Error())
	}

	a.setSecretKey(newKey)
	return a.authResult(true, "Password changed.")
}

// settings methods
func (a *App) GetSettings() Settings {
	var s Settings
	if a.db == nil {
		return defaultSettings()
	}

	err := a.db.QueryRow("SELECT coaching_style, analysis_depth, model_name, emotion_model, user_name, crisis_region, onboarding_complete FROM settings WHERE id = 1").
		Scan(&s.CoachingStyle, &s.AnalysisDepth, &s.ModelName, &s.EmotionModel, &s.UserName, &s.CrisisRegion, &s.OnboardingComplete)
	if err != nil {
		// return defaults if row doesn't exist yet
		return defaultSettings()
	}
	s.ModelName = canonicalOllamaModelName(s.ModelName)
	s.EmotionModel = canonicalEmotionModelName(s.EmotionModel)
	s.CrisisRegion = normalizeCrisisRegion(s.CrisisRegion)
	return s
}

func (a *App) GetSanctumDirectory() string {
	if strings.TrimSpace(a.sanctumDir) != "" {
		return filepath.Clean(a.sanctumDir)
	}
	if strings.TrimSpace(a.dbPath) != "" {
		return filepath.Clean(filepath.Dir(a.dbPath))
	}
	appDataDir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Clean(filepath.Join(appDataDir, "Sanctum"))
}

func (a *App) SaveSettings(style, depth, model, emotionModel, username, crisisRegion string, onboardingComplete bool) string {
	if a.db == nil {
		return "Database not initialized"
	}

	model = canonicalOllamaModelName(model)
	emotionModel = canonicalEmotionModelName(emotionModel)
	crisisRegion = normalizeCrisisRegion(crisisRegion)

	_, err := a.db.Exec(`
		UPDATE settings 
		SET coaching_style = ?, analysis_depth = ?, model_name = ?, emotion_model = ?, user_name = ?, crisis_region = ?, onboarding_complete = ?
		WHERE id = 1
	`, style, depth, model, emotionModel, username, crisisRegion, onboardingComplete)

	if err != nil {
		return "Error saving settings: " + err.Error()
	}
	return "Settings saved securely."
}

func (a *App) recordAnalysisAudit(event AnalysisAuditEvent) error {
	if a.db == nil {
		return errors.New("database not initialized")
	}
	if strings.TrimSpace(event.Mode) == "" {
		event.Mode = "local"
	}
	if strings.TrimSpace(event.ModelName) == "" {
		event.ModelName = "unknown"
	}
	if strings.TrimSpace(event.Purpose) == "" {
		event.Purpose = "journal_analysis"
	}

	_, err := a.db.Exec(`
		INSERT INTO analysis_audit (entry_id, mode, model_name, emotion_model, data_left_device, crisis_detected, purpose)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, event.EntryID, event.Mode, event.ModelName, event.EmotionModel, event.DataLeftDevice, event.CrisisDetected, event.Purpose)
	return err
}

func (a *App) GetAnalysisAudit(limit int) []AnalysisAuditEvent {
	if !a.isVaultUnlocked() || a.db == nil {
		return []AnalysisAuditEvent{}
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	rows, err := a.db.Query(`
		SELECT id, created_at, entry_id, mode, model_name, emotion_model, data_left_device, crisis_detected, purpose
		FROM analysis_audit
		ORDER BY id DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return []AnalysisAuditEvent{}
	}
	defer rows.Close()

	var events []AnalysisAuditEvent
	for rows.Next() {
		var event AnalysisAuditEvent
		if err := rows.Scan(
			&event.ID,
			&event.CreatedAt,
			&event.EntryID,
			&event.Mode,
			&event.ModelName,
			&event.EmotionModel,
			&event.DataLeftDevice,
			&event.CrisisDetected,
			&event.Purpose,
		); err != nil {
			continue
		}
		events = append(events, event)
	}
	return events
}

// encryption helpers
func encryptBytesWithKey(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	result := make([]byte, 0, len(encryptedBlobMagic)+len(nonce)+len(ciphertext))
	result = append(result, encryptedBlobMagic...)
	result = append(result, nonce...)
	result = append(result, ciphertext...)
	return result, nil
}

func decryptBytesWithKey(key, encrypted []byte) ([]byte, error) {
	if !bytes.HasPrefix(encrypted, encryptedBlobMagic) {
		return nil, fmt.Errorf("unsupported encrypted payload format")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	encrypted = encrypted[len(encryptedBlobMagic):]
	nonceSize := gcm.NonceSize()
	if len(encrypted) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := encrypted[:nonceSize], encrypted[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func (a *App) encryptEntryPayload(payload encryptedEntryPayload) ([]byte, error) {
	key, err := a.currentSecretKey()
	if err != nil {
		return nil, err
	}
	payload.Version = entryPayloadVersion
	plaintext, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return encryptBytesWithKey(key, plaintext)
}

func (a *App) decryptEntryPayload(encrypted []byte) (encryptedEntryPayload, error) {
	key, err := a.currentSecretKey()
	if err != nil {
		return encryptedEntryPayload{}, err
	}
	plaintext, err := decryptBytesWithKey(key, encrypted)
	if err != nil {
		return encryptedEntryPayload{}, err
	}
	var payload encryptedEntryPayload
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		return encryptedEntryPayload{}, err
	}
	if payload.Version != entryPayloadVersion {
		return encryptedEntryPayload{}, fmt.Errorf("unsupported entry payload version: %d", payload.Version)
	}
	payload.Emotions = normalizeEmotions(payload.Emotions)
	return payload, nil
}

// exposed methods for frontend
func (a *App) SaveEntry(id int, title string, text string, emotions []string, coaching string) string {
	if _, err := a.currentSecretKey(); err != nil {
		return "Vault is locked. Unlock Sanctum before saving."
	}

	if title == "" {
		title = "Untitled Entry"
	}

	// normalize labels before they enter the encrypted payload
	emotions = normalizeEmotions(emotions)

	// generated embedding vector for semantic search
	embeddingVector := a.generateEmbeddingForEntry(text)

	encryptedData, err := a.encryptEntryPayload(encryptedEntryPayload{
		Title:     title,
		Content:   text,
		Emotions:  emotions,
		Coaching:  coaching,
		Embedding: embeddingVector,
	})
	if err != nil {
		return "Error encrypting data: " + err.Error()
	}

	if id == 0 {
		// new entry
		_, err = a.db.Exec("INSERT INTO entries (payload) VALUES (?)", encryptedData)
	} else {
		// update existing entry
		_, err = a.db.Exec("UPDATE entries SET payload = ? WHERE id = ?", encryptedData, id)
	}

	if err != nil {
		return "Error saving to DB: " + err.Error()
	}
	return "Entry saved securely."
}

func (a *App) DeleteEntry(id int) string {
	if _, err := a.currentSecretKey(); err != nil {
		return "Vault is locked. Unlock Sanctum before deleting entries."
	}

	_, err := a.db.Exec("DELETE FROM entries WHERE id = ?", id)
	if err != nil {
		return "Error deleting entry: " + err.Error()
	}
	return "Entry deleted."
}

func (a *App) GetEntries() []Entry {
	if _, err := a.currentSecretKey(); err != nil {
		return []Entry{}
	}

	rows, err := a.db.Query("SELECT id, payload, created_at FROM entries ORDER BY id DESC")
	if err != nil {
		return []Entry{}
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var id int
		var encryptedBlob []byte
		var createdAt string

		err := rows.Scan(&id, &encryptedBlob, &createdAt)
		if err != nil {
			fmt.Println("Scan error:", err)
			continue
		}

		payload, err := a.decryptEntryPayload(encryptedBlob)
		if err != nil {
			fmt.Println("Decrypt error:", err)
			continue
		}

		// short preview
		preview := payload.Content
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}

		entries = append(entries, Entry{
			ID:        id,
			Title:     payload.Title,
			Content:   payload.Content,
			Preview:   preview,
			Emotions:  payload.Emotions,
			Coaching:  payload.Coaching,
			CreatedAt: createdAt,
		})
	}
	return entries
}

type AnalysisResult struct {
	Emotions       []string `json:"emotions"`
	Coaching       string   `json:"coaching"`
	SimilarEntries []Entry  `json:"similar_entries,omitempty"`
}

// Crisis detection
type CrisisResult struct {
	IsCrisis bool     `json:"is_crisis"`
	Severity string   `json:"severity"` // "high" or "moderate"
	Patterns []string `json:"patterns"`
}

// compiled regex patterns for crisis detection
var crisisPatterns = []struct {
	Pattern  *regexp.Regexp
	Label    string
	Severity string
}{
	// HIGH severity — immediate risk indicators
	{regexp.MustCompile(`(?i)\b(kill\s+(myself|me)|end\s+(my\s+life|it\s+all)|suicide|suicidal|want\s+to\s+die|don'?t\s+want\s+to\s+(live|be\s+alive|exist))\b`), "suicidal ideation", "high"},
	{regexp.MustCompile(`(?i)\b(cut(ting)?\s+(myself|my\s+(wrist|arm|skin))|self[\s-]?harm(ing)?|hurt(ing)?\s+myself|burn(ing)?\s+myself)`), "self-harm", "high"},
	{regexp.MustCompile(`(?i)\b(plan(ning)?\s+to\s+(die|end)|method\s+to\s+(die|end)|goodbye\s+(letter|note|everyone|world)|no\s+reason\s+to\s+(live|go\s+on))\b`), "crisis planning", "high"},

	// MODERATE severity — distress signals that warrant gentle intervention
	{regexp.MustCompile(`(?i)\b(everyone\s+would\s+be\s+better\s+off\s+without\s+me|i\s+am\s+a\s+burden|can'?t\s+take\s+(it|this)\s+anymore|i\s+give\s+up\s+on\s+(life|everything))\b`), "hopelessness", "moderate"},
	{regexp.MustCompile(`(?i)\b(overdose|swallow(ing)?\s+pills\s+to|jump(ing)?\s+off|hang(ing)?\s+myself)\b`), "means reference", "high"},
}

// CheckCrisisMarkers scans text for crisis indicators using regex.
// This is intentionally separate from the LLM to guarantee it works offline and instantly.
func (a *App) CheckCrisisMarkers(text string) CrisisResult {
	result := CrisisResult{
		IsCrisis: false,
		Severity: "",
		Patterns: []string{},
	}

	highestSeverity := ""

	for _, cp := range crisisPatterns {
		if cp.Pattern.MatchString(text) {
			result.IsCrisis = true
			result.Patterns = append(result.Patterns, cp.Label)

			// track highest severity
			if cp.Severity == "high" {
				highestSeverity = "high"
			} else if highestSeverity == "" {
				highestSeverity = cp.Severity
			}
		}
	}

	result.Severity = highestSeverity
	return result
}

func (a *App) AnalyzeJournal(entryText string) AnalysisResult {
	if !a.isVaultUnlocked() {
		return AnalysisResult{Coaching: "Unlock Sanctum before analyzing entries."}
	}
	return a.analyzeJournal(entryText, 0)
}

// analyzes an existing entry while excluding it from RAG context.
func (a *App) AnalyzeJournalForEntry(entryText string, currentEntryId int) AnalysisResult {
	if !a.isVaultUnlocked() {
		return AnalysisResult{Coaching: "Unlock Sanctum before analyzing entries."}
	}
	return a.analyzeJournal(entryText, currentEntryId)
}

func buildJournalAnalysisPrompt(entryText, styleDirective, ragContext, depthDirective string) string {
	return fmt.Sprintf(`You are a CBT-informed journaling coach. Analyze this journal entry and respond with JSON.

ENTRY: "%s"

COACHING STYLE: %s%s

RULES:
1. Detect the PRIMARY emotional tone of the entry — what the person is FEELING NOW, not words they merely mention.
2. If the entry is POSITIVE (celebrating, grateful, proud), reinforce the behaviour. Do NOT reframe positive entries.
3. If the entry is NEGATIVE (distorted thinking, rumination, self-criticism), provide a gentle cognitive reframe.
4. If MIXED, acknowledge the positive and gently address the negative.
5. You are NOT a therapist. Never diagnose. Never prescribe. If they mention professional help, encourage it.

RESPOND WITH JSON:
- "emotions": Array of 1-3 emotions the person is currently feeling (NOT keywords they mention).
- "coaching": %s

EXAMPLES:

Entry: "I was walking today for 3 hours and I feel amazing. I need to walk more, especially when anxious."
{"emotions": ["Proud", "Energised"], "coaching": "Walking is a powerful coping tool — you've found something that genuinely works for you."}

Entry: "I failed the exam. I'm so stupid. I'll never get this right."
{"emotions": ["Frustrated", "Self-Critical"], "coaching": "One exam doesn't define your ability — what would you say to a friend in this situation?"}

Entry: "Had a good day at work but I keep thinking about what my colleague said. Maybe they're right about me."
{"emotions": ["Anxious", "Reflective"], "coaching": "A good day happened — that's real. One comment doesn't erase it. What evidence contradicts their words?"}

JSON Response:`, entryText, styleDirective, ragContext, depthDirective)
}

// function to send text to local Ollama instance and return structured data
func (a *App) analyzeJournal(entryText string, currentEntryId int) AnalysisResult {
	url := "http://localhost:11434/api/generate"

	// load user settings to personalise the coaching style
	settings := a.GetSettings()
	primaryModel := canonicalOllamaModelName(settings.ModelName)
	emotionModel := canonicalEmotionModelName(settings.EmotionModel)
	isDualModel := emotionModel != defaultEmotionModel

	// check for crisis markers before invoking LLM
	crisis := a.CheckCrisisMarkers(entryText)
	if crisis.IsCrisis {
		if err := a.recordAnalysisAudit(AnalysisAuditEvent{
			EntryID:        currentEntryId,
			Mode:           "local",
			ModelName:      "crisis-safety-check",
			DataLeftDevice: false,
			CrisisDetected: true,
			Purpose:        "crisis_safety_check",
		}); err != nil {
			log.Printf("Could not record crisis audit event: %v", err)
		}
		return AnalysisResult{
			Emotions: []string{"Crisis Detected"},
			Coaching: "AI coaching is paused for your safety. Please see the crisis resources displayed.",
		}
	}

	// map coaching style to system prompt personality
	styleDirective := map[string]string{
		"compassionate": "Respond with warmth, empathy, and gentle encouragement. Validate feelings before reframing.",
		"direct":        "Be concise, honest, and straightforward. Focus on actionable insight without sugar-coating.",
		"socratic":      "Respond with a thought-provoking question that helps the user discover their own insight.",
		"motivational":  "Be energising and uplifting. Focus on strengths, growth, and forward momentum.",
	}[settings.CoachingStyle]
	if styleDirective == "" {
		styleDirective = "Respond with warmth, empathy, and gentle encouragement."
	}

	// coaching depth
	depthDirective := "One sentence (MAX 20 WORDS). No filler."
	if settings.AnalysisDepth == "detailed" {
		depthDirective = "2-3 sentences: a coaching insight, then one concrete actionable suggestion the user can try today."
	}

	// fetch RAG context (similar past entries)
	similarEntries := a.FindSimilarEntries(entryText, currentEntryId, 2)
	ragContext := ""
	if len(similarEntries) > 0 {
		ragContext = "\n\nPAST JOURNAL ENTRIES FOR CONTEXT:\n"
		for _, se := range similarEntries {
			// strip exact date, keep the text and preview to inform the LLM of past states
			ragContext += fmt.Sprintf("- Past Entry (%s): %s\n", se.CreatedAt, se.Content)
		}
		ragContext += "\nIf relevant, gently weave in a connection to how they handled things in the past."
	}

	auditEmotionModel := ""
	if isDualModel {
		auditEmotionModel = emotionModel
	}
	if err := a.recordAnalysisAudit(AnalysisAuditEvent{
		EntryID:        currentEntryId,
		Mode:           "local",
		ModelName:      primaryModel,
		EmotionModel:   auditEmotionModel,
		DataLeftDevice: false,
		CrisisDetected: false,
		Purpose:        "journal_analysis",
	}); err != nil {
		log.Printf("Could not record analysis audit event: %v", err)
	}

	// base coaching prompt
	prompt := buildJournalAnalysisPrompt(entryText, styleDirective, ragContext, depthDirective)

	requestBody, _ := json.Marshal(map[string]interface{}{
		"model":  primaryModel,
		"prompt": prompt,
		"stream": false,
		"format": "json",
	})

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		return AnalysisResult{Coaching: "Error connecting to Local AI. Is Ollama running?"}
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	responseStr, ok := result["response"].(string)
	if !ok {
		return AnalysisResult{Coaching: "Invalid response from AI."}
	}

	// parse JSON from LLM
	var analysis AnalysisResult
	err = json.Unmarshal([]byte(responseStr), &analysis)
	if err != nil {
		return AnalysisResult{
			Emotions:       []string{"Uncertain"},
			Coaching:       responseStr,
			SimilarEntries: similarEntries,
		}
	}

	analysis.SimilarEntries = similarEntries
	analysis.Emotions = normalizeEmotions(analysis.Emotions)

	// If dual-model is active, invoke EmoLLM to override the general model's emotion array
	if isDualModel {
		emotions, err := a.analyzeEmotionsWithModel(url, emotionModel, entryText)
		if err != nil {
			log.Printf("Emotion model %q unavailable, using primary model emotions: %v", emotionModel, err)
		} else {
			analysis.Emotions = emotions
		}
	}

	return analysis
}

func parseEmotionResponse(responseStr string) ([]string, error) {
	var analysis AnalysisResult
	if err := json.Unmarshal([]byte(responseStr), &analysis); err == nil && len(analysis.Emotions) > 0 {
		return normalizeEmotions(analysis.Emotions), nil
	}

	var emotions []string
	if err := json.Unmarshal([]byte(responseStr), &emotions); err == nil && len(emotions) > 0 {
		return normalizeEmotions(emotions), nil
	}

	return nil, errors.New("emotion model returned no usable emotions")
}

func parseEmotionModelHTTPResponse(emoResp *http.Response) ([]string, error) {
	if emoResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(emoResp.Body, 4096))
		bodyText := strings.TrimSpace(string(body))
		if bodyText == "" {
			return nil, fmt.Errorf("emotion model returned HTTP %d", emoResp.StatusCode)
		}
		return nil, fmt.Errorf("emotion model returned HTTP %d: %s", emoResp.StatusCode, bodyText)
	}

	var emoResult struct {
		Response string `json:"response"`
		Error    string `json:"error"`
	}
	if err := json.NewDecoder(emoResp.Body).Decode(&emoResult); err != nil {
		return nil, fmt.Errorf("could not decode emotion model response: %w", err)
	}
	if emoResult.Error != "" {
		return nil, errors.New(emoResult.Error)
	}
	if strings.TrimSpace(emoResult.Response) == "" {
		return nil, errors.New("emotion model returned an empty response")
	}

	emotions, err := parseEmotionResponse(emoResult.Response)
	if err != nil {
		return nil, err
	}
	if len(emotions) == 0 {
		return nil, errors.New("emotion model returned no emotions")
	}

	return emotions, nil
}

func (a *App) analyzeEmotionsWithModel(url, modelName, entryText string) ([]string, error) {
	emoPrompt := fmt.Sprintf(`You are an expert emotion analysis system. Read this journal entry and return ONLY this JSON object with 1 to 3 primary emotions the author is currently feeling. No explanation, markdown, or extra text.

ENTRY: "%s"

RESPOND STRICTLY IN THIS FORMAT:
{"emotions": ["Emotion1", "Emotion2"]}`, entryText)

	emoReqBody, _ := json.Marshal(map[string]interface{}{
		"model":  modelName,
		"prompt": emoPrompt,
		"stream": false,
		"format": "json",
	})

	emoResp, err := http.Post(url, "application/json", bytes.NewBuffer(emoReqBody))
	if err != nil {
		return nil, err
	}
	defer emoResp.Body.Close()

	return parseEmotionModelHTTPResponse(emoResp)
}

// mock implementation of OpenAI API
func (a *App) AnalyzeJournalCloud(entryText string, apiKey string) AnalysisResult {
	if !a.isVaultUnlocked() {
		return AnalysisResult{Coaching: "Unlock Sanctum before analyzing entries."}
	}

	if err := a.recordAnalysisAudit(AnalysisAuditEvent{
		Mode:           "cloud-mock",
		ModelName:      "mock-openai",
		DataLeftDevice: false,
		CrisisDetected: false,
		Purpose:        "journal_analysis",
	}); err != nil {
		log.Printf("Could not record cloud audit event: %v", err)
	}

	return AnalysisResult{
		Emotions: []string{"Cloud-Analyzed", "Insightful"},
		Coaching: "This is a cloud-powered insight (Simulated). Your thought patterns suggest a need for rest. Try the '5-4-3-2-1' grounding technique.",
	}
}

// Onboarding & Hardware Detection
type HardwareInfo struct {
	OS          string `json:"os"`
	TotalRAMGB  int    `json:"total_ram_gb"`
	Recommended string `json:"recommended_model"`
}

type PullModelProgress struct {
	Model     string `json:"model"`
	Status    string `json:"status"`
	Digest    string `json:"digest,omitempty"`
	Total     int64  `json:"total,omitempty"`
	Completed int64  `json:"completed,omitempty"`
	Error     string `json:"error,omitempty"`
}

var ollamaStatusClient = &http.Client{Timeout: 5 * time.Second}

// macOS specific hardware detection using sysctl
func (a *App) DetectHardware() HardwareInfo {
	info := HardwareInfo{
		OS:          "macOS", // macOS only for now
		TotalRAMGB:  8,       // fallback
		Recommended: "qwen3:4b",
	}

	// try reading memory size via sysctl (macOS specific)
	out, err := exec.Command("sysctl", "-n", "hw.memsize").Output()
	if err == nil {
		memBytes, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
		if err == nil {
			info.TotalRAMGB = int(memBytes / (1024 * 1024 * 1024))
		}
	}

	// simple recommendation logic based on RAM
	if info.TotalRAMGB < 8 {
		info.Recommended = "qwen3:1.7b"
	} else if info.TotalRAMGB >= 16 {
		info.Recommended = "qwen3:8b"
	} else {
		info.Recommended = "qwen3:4b" // 8GB-15GB sweet spot
	}

	return info
}

func (a *App) IsOllamaRunning() bool {
	resp, err := ollamaStatusClient.Get("http://localhost:11434/")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

func (a *App) ListModels() []string {
	resp, err := ollamaStatusClient.Get("http://localhost:11434/api/tags")
	if err != nil {
		return []string{}
	}
	defer resp.Body.Close()

	var result struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []string{}
	}

	models := make([]string, len(result.Models))
	for i, m := range result.Models {
		models[i] = m.Name
	}
	return models
}

func (a *App) emitPullModelProgress(progress PullModelProgress) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, "ollama:pull-progress", progress)
}

func (a *App) registerPullModelCancel(modelName string, cancel context.CancelFunc) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()

	if _, exists := a.pullCancels[modelName]; exists {
		return fmt.Errorf("%s is already downloading", modelName)
	}

	a.pullCancels[modelName] = cancel
	return nil
}

func (a *App) clearPullModelCancel(modelName string) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	delete(a.pullCancels, modelName)
}

func (a *App) CancelPullModel(modelName string) bool {
	requestedModel := strings.TrimSpace(modelName)
	modelName = canonicalOllamaModelName(requestedModel)

	a.pullMu.Lock()
	cancel, ok := a.pullCancels[modelName]
	a.pullMu.Unlock()

	if !ok {
		return false
	}

	cancel()
	a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Status: "canceled"})
	return true
}

func (a *App) PullModel(modelName string) error {
	requestedModel := strings.TrimSpace(modelName)
	modelName = canonicalOllamaModelName(requestedModel)
	if modelName == "" {
		err := errors.New("model name is required")
		a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Error: err.Error()})
		return err
	}

	requestBody, _ := json.Marshal(map[string]interface{}{
		"name":   modelName,
		"stream": true,
	})

	baseCtx := context.Background()
	if a.ctx != nil {
		baseCtx = a.ctx
	}
	pullCtx, cancel := context.WithCancel(baseCtx)
	defer cancel()

	if err := a.registerPullModelCancel(modelName, cancel); err != nil {
		a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Error: err.Error()})
		return err
	}
	defer a.clearPullModelCancel(modelName)

	req, err := http.NewRequestWithContext(pullCtx, http.MethodPost, "http://localhost:11434/api/pull", bytes.NewBuffer(requestBody))
	if err != nil {
		a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Error: err.Error()})
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if pullCtx.Err() != nil {
			a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Status: "canceled"})
			return errors.New("model download canceled")
		}
		a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Error: err.Error()})
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err := fmt.Errorf("Ollama API returned status: %d", resp.StatusCode)
		a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Error: err.Error()})
		return err
	}

	decoder := json.NewDecoder(resp.Body)
	for {
		var progress PullModelProgress
		if err := decoder.Decode(&progress); err != nil {
			if pullCtx.Err() != nil {
				a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Status: "canceled"})
				return errors.New("model download canceled")
			}
			if errors.Is(err, io.EOF) {
				break
			}
			a.emitPullModelProgress(PullModelProgress{Model: requestedModel, Error: err.Error()})
			return err
		}

		if progress.Error != "" {
			errMessage := friendlyPullModelError(requestedModel, modelName, progress.Error)
			progress.Model = requestedModel
			progress.Error = errMessage
			a.emitPullModelProgress(progress)
			return errors.New(errMessage)
		}

		progress.Model = requestedModel
		a.emitPullModelProgress(progress)
	}

	return nil
}

// Local RAG & Vector Search
func (a *App) generateEmbeddingForEntry(text string) []float64 {
	if a.embedText != nil {
		return a.embedText(text)
	}
	return a.GenerateEmbedding(text)
}

func (a *App) GenerateEmbedding(text string) []float64 {
	// uses nomic-embed-text for fast, high quality local embeddings
	requestBody, _ := json.Marshal(map[string]interface{}{
		"model":  "nomic-embed-text",
		"prompt": text,
	})

	resp, err := http.Post("http://localhost:11434/api/embeddings", "application/json", bytes.NewBuffer(requestBody))

	// auto-pull embedding model if not installed
	if err != nil || resp.StatusCode != 200 {
		_ = a.PullModel("nomic-embed-text")
		resp, err = http.Post("http://localhost:11434/api/embeddings", "application/json", bytes.NewBuffer(requestBody))
		if err != nil || resp.StatusCode != 200 {
			return []float64{}
		}
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []float64{}
	}

	embeddingData, ok := result["embedding"].([]interface{})
	if !ok {
		return []float64{}
	}

	vec := make([]float64, len(embeddingData))
	for i, v := range embeddingData {
		vec[i] = v.(float64)
	}
	return vec
}

func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

type scoredEntry struct {
	entry Entry
	score float64
}

func (a *App) FindSimilarEntries(queryText string, currentEntryId int, limit int) []Entry {
	if _, err := a.currentSecretKey(); err != nil {
		return []Entry{}
	}

	queryVec := a.generateEmbeddingForEntry(queryText)
	if len(queryVec) == 0 {
		return []Entry{}
	}

	rows, err := a.db.Query("SELECT id, payload, created_at FROM entries")
	if err != nil {
		return []Entry{}
	}
	defer rows.Close()

	var scoredEntries []scoredEntry

	for rows.Next() {
		var id int
		var createdAt string
		var encryptedBlob []byte

		if err := rows.Scan(&id, &encryptedBlob, &createdAt); err != nil {
			continue
		}

		// skip the current entry if we are editing it
		if id == currentEntryId {
			continue
		}

		payload, err := a.decryptEntryPayload(encryptedBlob)
		if err != nil || len(payload.Embedding) == 0 {
			continue
		}

		score := cosineSimilarity(queryVec, payload.Embedding)

		// arbitrary threshold for "similar"
		if score > 0.6 {
			if strings.TrimSpace(payload.Content) == strings.TrimSpace(queryText) {
				continue
			}

			preview := payload.Content
			if len(preview) > 150 {
				preview = preview[:150] + "..."
			}

			scoredEntries = append(scoredEntries, scoredEntry{
				score: score,
				entry: Entry{
					ID:        id,
					Title:     payload.Title,
					Content:   payload.Content,
					Preview:   preview,
					Emotions:  payload.Emotions,
					Coaching:  payload.Coaching,
					CreatedAt: createdAt,
				},
			})
		}
	}

	// sort by highest similarity score
	sort.Slice(scoredEntries, func(i, j int) bool {
		return scoredEntries[i].score > scoredEntries[j].score
	})

	var results []Entry
	for i := 0; i < len(scoredEntries) && i < limit; i++ {
		results = append(results, scoredEntries[i].entry)
	}

	return results
}
