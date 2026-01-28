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

	_ "github.com/mattn/go-sqlite3"
)

type App struct {
	ctx      context.Context
	db       *sql.DB
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
	
	fmt.Println("Database initialized at:", dbPath)
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

// function to send text to local Ollama instance and return structured data
func (a *App) AnalyzeJournal(entryText string) AnalysisResult {
	url := "http://localhost:11434/api/generate"
	
	// system prompt
	prompt := fmt.Sprintf(`You are an empathetic mental health coach. Analyze this journal entry: '%s'. 
	Return a valid JSON object with two keys:
	1. "emotions": a list of 1-3 detected emotions (e.g., ["Anxious", "Hopeful"]).
	2. "coaching": a brief, supportive coaching tip (under 50 words).
	
	IMPORTANT SAFETY RULES:
	- Do NOT provide medical diagnoses or prescriptions.
	- If the user asks for medical advice, return "I cannot provide medical advice. Please consult a professional." as the coaching tip.
	
	Do not include markdown formatting like asterisk or backticks. JSON only.`, entryText)

	requestBody, _ := json.Marshal(map[string]interface{}{
		"model":  "gemma:2b",
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
		// fallback if model didn't output perfect JSON
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