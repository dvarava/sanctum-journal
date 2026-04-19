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
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	Coaching  string   `json:"coaching"`
	CreatedAt string   `json:"created_at"`
}

type Settings struct {
	CoachingStyle      string `json:"coaching_style"` // compassionate, direct, socratic, motivational
	AnalysisDepth      string `json:"analysis_depth"` // brief, detailed
	ModelName          string `json:"model_name"`     // ollama model to use
	EmotionModel       string `json:"emotion_model"`  // ollama model to use for emotion analysis
	UserName           string `json:"user_name"`      // for personalised greeting
	OnboardingComplete bool   `json:"onboarding_complete"`
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
	_, _ = a.db.Exec("ALTER TABLE entries ADD COLUMN coaching TEXT DEFAULT '';")
	_, _ = a.db.Exec("ALTER TABLE entries ADD COLUMN embedding TEXT DEFAULT '[]';")

	// settings table
	_, err = a.db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		coaching_style TEXT DEFAULT 'compassionate',
		analysis_depth TEXT DEFAULT 'brief',
		model_name TEXT DEFAULT 'qwen3:4b',
		emotion_model TEXT DEFAULT 'default',
		user_name TEXT DEFAULT '',
		onboarding_complete BOOLEAN DEFAULT 0
	);`)
	if err != nil {
		log.Fatalf("Error creating settings table: %v\n", err)
	}
	// ensure defaults row exists
	_, _ = a.db.Exec(`INSERT OR IGNORE INTO settings (id) VALUES (1);`)

	// migrations for existing DBs
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN user_name TEXT DEFAULT '';")
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN onboarding_complete BOOLEAN DEFAULT 0;")
	_, _ = a.db.Exec("ALTER TABLE settings ADD COLUMN emotion_model TEXT DEFAULT 'default';")

	fmt.Println("Database initialized at:", dbPath)
}

// settings methods
func (a *App) GetSettings() Settings {
	var s Settings
	if a.db == nil {
		return Settings{CoachingStyle: "compassionate", AnalysisDepth: "brief", ModelName: "qwen3:4b", EmotionModel: "default", OnboardingComplete: false}
	}

	err := a.db.QueryRow("SELECT coaching_style, analysis_depth, model_name, emotion_model, user_name, onboarding_complete FROM settings WHERE id = 1").
		Scan(&s.CoachingStyle, &s.AnalysisDepth, &s.ModelName, &s.EmotionModel, &s.UserName, &s.OnboardingComplete)
	if err != nil {
		// return defaults if row doesn't exist yet
		return Settings{CoachingStyle: "compassionate", AnalysisDepth: "brief", ModelName: "qwen3:4b", EmotionModel: "default", OnboardingComplete: false}
	}
	return s
}

func (a *App) SaveSettings(style, depth, model, emotionModel, username string, onboardingComplete bool) string {
	if a.db == nil {
		return "Database not initialized"
	}

	_, err := a.db.Exec(`
		UPDATE settings 
		SET coaching_style = ?, analysis_depth = ?, model_name = ?, emotion_model = ?, user_name = ?, onboarding_complete = ?
		WHERE id = 1
	`, style, depth, model, emotionModel, username, onboardingComplete)

	if err != nil {
		return "Error saving settings: " + err.Error()
	}
	return "Settings saved securely."
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
func (a *App) SaveEntry(id int, title string, text string, emotions []string, coaching string) string {
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

	// generated embedding vector for semantic search
	embeddingVector := a.GenerateEmbedding(text)
	embeddingJSON, _ := json.Marshal(embeddingVector)
	if embeddingJSON == nil || len(embeddingVector) == 0 {
		embeddingJSON = []byte("[]")
	}

	if id == 0 {
		// new entry
		_, err = a.db.Exec("INSERT INTO entries (title, content, emotions, coaching, embedding) VALUES (?, ?, ?, ?, ?)", title, encryptedData, string(emotionsJSON), coaching, string(embeddingJSON))
	} else {
		// update existing entry
		_, err = a.db.Exec("UPDATE entries SET title = ?, content = ?, emotions = ?, coaching = ?, embedding = ? WHERE id = ?", title, encryptedData, string(emotionsJSON), coaching, string(embeddingJSON), id)
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
	rows, err := a.db.Query("SELECT id, title, content, emotions, coaching, created_at FROM entries ORDER BY id DESC")
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
		var coaching string
		var createdAt string

		err := rows.Scan(&id, &title, &encryptedBlob, &emotionsJSON, &coaching, &createdAt)
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
			Coaching:  coaching,
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
	return a.analyzeJournal(entryText, 0)
}

// analyzes an existing entry while excluding it from RAG context.
func (a *App) AnalyzeJournalForEntry(entryText string, currentEntryId int) AnalysisResult {
	return a.analyzeJournal(entryText, currentEntryId)
}

// function to send text to local Ollama instance and return structured data
func (a *App) analyzeJournal(entryText string, currentEntryId int) AnalysisResult {
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

	// system prompt with injected style, few-shot examples, and RAG context
	// if using a specialized EmoLLM, optionally override the 'emotions' field later
	isDualModel := settings.EmotionModel != "default" && settings.EmotionModel != ""

	// base coaching prompt
	prompt := fmt.Sprintf(`You are a CBT-informed journaling coach. Analyze this journal entry and respond with JSON.

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
			Emotions:       []string{"Uncertain"},
			Coaching:       responseStr,
			SimilarEntries: similarEntries,
		}
	}

	analysis.SimilarEntries = similarEntries

	// If dual-model is active, invoke EmoLLM to override the general model's emotion array
	if isDualModel {
		emoPrompt := fmt.Sprintf(`You are an expert emotion analysis system. Read this journal entry and return ONLY a JSON array of 1 to 3 primary emotions the author is currently feeling. No explanation.
		
		ENTRY: "%s"
		
		RESPOND STRICTLY IN THIS FORMAT:
		{"emotions": ["Emotion1", "Emotion2"]}
		`, entryText)

		emoReqBody, _ := json.Marshal(map[string]interface{}{
			"model":  settings.EmotionModel,
			"prompt": emoPrompt,
			"stream": false,
			"format": "json",
		})

		emoResp, err := http.Post(url, "application/json", bytes.NewBuffer(emoReqBody))
		if err == nil {
			defer emoResp.Body.Close()
			var emoResult map[string]interface{}
			_ = json.NewDecoder(emoResp.Body).Decode(&emoResult)
			if emoResponseStr, ok := emoResult["response"].(string); ok {
				var emoAnalysis AnalysisResult
				if err := json.Unmarshal([]byte(emoResponseStr), &emoAnalysis); err == nil && len(emoAnalysis.Emotions) > 0 {
					analysis.Emotions = emoAnalysis.Emotions
				}
			}
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

func (a *App) PullModel(modelName string) error {
	requestBody, _ := json.Marshal(map[string]interface{}{
		"name":   modelName,
		"stream": true,
	})

	resp, err := http.Post("http://localhost:11434/api/pull", "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		a.emitPullModelProgress(PullModelProgress{Model: modelName, Error: err.Error()})
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err := fmt.Errorf("Ollama API returned status: %d", resp.StatusCode)
		a.emitPullModelProgress(PullModelProgress{Model: modelName, Error: err.Error()})
		return err
	}

	decoder := json.NewDecoder(resp.Body)
	for {
		var progress PullModelProgress
		if err := decoder.Decode(&progress); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			a.emitPullModelProgress(PullModelProgress{Model: modelName, Error: err.Error()})
			return err
		}

		progress.Model = modelName
		a.emitPullModelProgress(progress)

		if progress.Error != "" {
			return errors.New(progress.Error)
		}
	}

	return nil
}

// Local RAG & Vector Search
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
	queryVec := a.GenerateEmbedding(queryText)
	if len(queryVec) == 0 {
		return []Entry{}
	}

	rows, err := a.db.Query("SELECT id, title, content, emotions, coaching, created_at, embedding FROM entries")
	if err != nil {
		return []Entry{}
	}
	defer rows.Close()

	var scoredEntries []scoredEntry

	for rows.Next() {
		var id int
		var title, emotionsJSON, coaching, createdAt, embeddingStr string
		var encryptedBlob []byte

		if err := rows.Scan(&id, &title, &encryptedBlob, &emotionsJSON, &coaching, &createdAt, &embeddingStr); err != nil {
			continue
		}

		// skip the current entry if we are editing it
		if id == currentEntryId {
			continue
		}

		var entryVec []float64
		if err := json.Unmarshal([]byte(embeddingStr), &entryVec); err != nil || len(entryVec) == 0 {
			continue
		}

		score := cosineSimilarity(queryVec, entryVec)

		// arbitrary threshold for "similar"
		if score > 0.6 {
			decrypted, err := a.decrypt(encryptedBlob)
			if err != nil {
				continue
			}

			if strings.TrimSpace(decrypted) == strings.TrimSpace(queryText) {
				continue
			}

			preview := decrypted
			if len(preview) > 150 {
				preview = preview[:150] + "..."
			}

			var emotions []string
			_ = json.Unmarshal([]byte(emotionsJSON), &emotions)

			scoredEntries = append(scoredEntries, scoredEntry{
				score: score,
				entry: Entry{
					ID:        id,
					Title:     title,
					Content:   decrypted,
					Preview:   preview,
					Emotions:  emotions,
					Coaching:  coaching,
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
