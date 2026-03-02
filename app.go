package main

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"

	_ "github.com/mattn/go-sqlite3"
)

type App struct {
	ctx       context.Context
	db        *sql.DB
	secretKey []byte // just for prototype, will derive this from a user password using Argon2 in future
}

func NewApp() *App {
	// for prototype: Hardcoded 32-byte key (AES-256).
	// in production, replace with Argon2 key derivation from user password
	key, _ := hex.DecodeString("6368616e676520746869732070617373776f726420746f206120736563726574")
	return &App{
		secretKey: key,
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
	CreatedAt string   `json:"created_at"`
}

type Settings struct {
	CoachingStyle string `json:"coaching_style"` // compassionate, direct, socratic, motivational
	AnalysisDepth string `json:"analysis_depth"` // brief, detailed
	ModelName     string `json:"model_name"`     // ollama model to use
	UserName      string `json:"user_name"`      // for personalised greeting
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

	dbPath := filepath.Join(sanctumDir, "sanctum_proto.db")

	var err error
	a.db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Println("Error opening DB:", err)
		return
	}

	// create table if not exists
	sqlStmt := `CREATE TABLE IF NOT EXISTS entries (
		id INTEGER PRIMARY KEY, 
		title TEXT DEFAULT '',
		content BLOB, 
		emotions TEXT DEFAULT '[]',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`
	_, err = a.db.Exec(sqlStmt)
	if err != nil {
		fmt.Println("Error creating table:", err)
	}

	// for existing DBs
	_, _ = a.db.Exec("ALTER TABLE entries ADD COLUMN title TEXT DEFAULT '';")
	_, _ = a.db.Exec("ALTER TABLE entries ADD COLUMN emotions TEXT DEFAULT '[]';")

	// settings table
	_, err = a.db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		coaching_style TEXT DEFAULT 'compassionate',
		analysis_depth TEXT DEFAULT 'brief',
		model_name TEXT DEFAULT 'gemma:2b',
		user_name TEXT DEFAULT ''
	);`)
	if err != nil {
		fmt.Println("Error creating settings table:", err)
	}
	// ensure defaults row exists
	_, _ = a.db.Exec(`INSERT OR IGNORE INTO settings (id) VALUES (1);`)

	// migrations for existing DBs
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN user_name TEXT DEFAULT '';")

	fmt.Println("Database initialized at:", dbPath)
}

// settings methods
func (a *App) GetSettings() Settings {
	defaults := Settings{
		CoachingStyle: "compassionate",
		AnalysisDepth: "brief",
		ModelName:     "gemma:2b",
		UserName:      "",
	}

	if a.db == nil {
		return defaults
	}

	row := a.db.QueryRow("SELECT coaching_style, analysis_depth, model_name, user_name FROM settings WHERE id = 1")
	var s Settings
	err := row.Scan(&s.CoachingStyle, &s.AnalysisDepth, &s.ModelName, &s.UserName)
	if err != nil {
		return defaults
	}
	return s
}

func (a *App) SaveSettings(coachingStyle, analysisDepth, modelName, userName string) string {
	if a.db == nil {
		return "Database not initialized"
	}

	_, err := a.db.Exec(
		"UPDATE settings SET coaching_style = ?, analysis_depth = ?, model_name = ?, user_name = ? WHERE id = 1",
		coachingStyle, analysisDepth, modelName, userName,
	)
	if err != nil {
		return "Error saving settings: " + err.Error()
	}
	return "Settings saved."
}

// encryption helpers
func (a *App) encrypt(plaintext string) ([]byte, error) {
	block, err := aes.NewCipher(a.secretKey)
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
	return gcm.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

func (a *App) decrypt(ciphertext []byte) (string, error) {
	block, err := aes.NewCipher(a.secretKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// exposed methods for frontend
func (a *App) SaveEntry(id int, title string, text string, emotions []string) string {
	encryptedData, err := a.encrypt(text)
	if err != nil {
		return "Error encrypting data: " + err.Error()
	}

	if title == "" {
		title = "Untitled Entry"
	}

	// emotions to JSON string
	emotionsJSON, _ := json.Marshal(emotions)
	if emotionsJSON == nil {
		emotionsJSON = []byte("[]")
	}

	if id == 0 {
		// new entry
		_, err = a.db.Exec("INSERT INTO entries (title, content, emotions) VALUES (?, ?, ?)", title, encryptedData, string(emotionsJSON))
	} else {
		// update existing entry
		_, err = a.db.Exec("UPDATE entries SET title = ?, content = ?, emotions = ? WHERE id = ?", title, encryptedData, string(emotionsJSON), id)
	}

	if err != nil {
		return "Error saving to DB: " + err.Error()
	}
	return "Entry saved securely."
}

func (a *App) DeleteEntry(id int) string {
	_, err := a.db.Exec("DELETE FROM entries WHERE id = ?", id)
	if err != nil {
		return "Error deleting entry: " + err.Error()
	}
	return "Entry deleted."
}

func (a *App) GetEntries() []Entry {
	rows, err := a.db.Query("SELECT id, title, content, emotions, created_at FROM entries ORDER BY id DESC")
	if err != nil {
		return []Entry{}
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var id int
		var title string
		var encryptedBlob []byte
		var emotionsJSON string
		var createdAt string

		err := rows.Scan(&id, &title, &encryptedBlob, &emotionsJSON, &createdAt)
		if err != nil {
			fmt.Println("Scan error:", err)
			continue
		}

		decrypted, _ := a.decrypt(encryptedBlob)

		// short preview
		preview := decrypted
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}

		var emotions []string
		_ = json.Unmarshal([]byte(emotionsJSON), &emotions)

		entries = append(entries, Entry{
			ID:        id,
			Title:     title,
			Content:   decrypted,
			Preview:   preview,
			Emotions:  emotions,
			CreatedAt: createdAt,
		})
	}
	return entries
}

type AnalysisResult struct {
	Emotions []string `json:"emotions"`
	Coaching string   `json:"coaching"`
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

// function to send text to local Ollama instance and return structured data
func (a *App) AnalyzeJournal(entryText string) AnalysisResult {
	url := "http://localhost:11434/api/generate"

	// check for crisis markers before invoking LLM
	crisis := a.CheckCrisisMarkers(entryText)
	if crisis.IsCrisis {
		return AnalysisResult{
			Emotions: []string{"Crisis Detected"},
			Coaching: "AI coaching is paused for your safety. Please see the crisis resources displayed.",
		}
	}

	// load user settings to personalise the coaching style
	settings := a.GetSettings()

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
	depthDirective := "A single, punchy cognitive reframe (MAX 15 WORDS)."
	if settings.AnalysisDepth == "detailed" {
		depthDirective = "A thoughtful 2-3 sentence coaching response with a cognitive reframe and one actionable suggestion."
	}

	// system prompt with injected style
	prompt := fmt.Sprintf(`You are a supportive journaling coach. Analyze this journal entry: "%s"

COACHING STYLE: %s

IMPORTANT RULES:
- You are NOT a therapist or medical professional.
- Never diagnose conditions or prescribe treatments.
- Focus on cognitive reframing and self-reflection.
- If the entry mentions professional help, encourage it.

Return a JSON object with:
1. "emotions": Array of 1-3 detected emotions.
2. "coaching": %s

Example:
{"emotions": ["Anxious"], "coaching": "Your productivity does not define your worth."}

JSON Response:`, entryText, styleDirective, depthDirective)

	requestBody, _ := json.Marshal(map[string]interface{}{
		"model":  settings.ModelName,
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
			Emotions: []string{"Uncertain"},
			Coaching: responseStr,
		}
	}

	return analysis
}

// mock implementation of OpenAI API
func (a *App) AnalyzeJournalCloud(entryText string, apiKey string) AnalysisResult {

	return AnalysisResult{
		Emotions: []string{"Cloud-Analyzed", "Insightful"},
		Coaching: "This is a cloud-powered insight (Simulated). Your thought patterns suggest a need for rest. Try the '5-4-3-2-1' grounding technique.",
	}
}
