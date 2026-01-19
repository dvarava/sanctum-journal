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
	secretKey []byte // for prototype, will derive this from a user password using Argon2 in future
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

// initialize the local SQLite database
func (a *App) initDB() {
	appDataDir, _ := os.UserConfigDir()
	dbPath := filepath.Join(appDataDir, "sanctum_proto.db")

	var err error
	a.db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Println("Error opening DB:", err)
		return
	}

	// create table if not exists
	sqlStmt := `CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, content BLOB, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`
	_, err = a.db.Exec(sqlStmt)
	if err != nil {
		fmt.Println("Error creating table:", err)
	}
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
func (a *App) SaveEntry(text string) string {
	encryptedData, err := a.encrypt(text)
	if err != nil {
		return "Error encrypting data: " + err.Error()
	}

	_, err = a.db.Exec("INSERT INTO entries (content) VALUES (?)", encryptedData)
	if err != nil {
		return "Error saving to DB: " + err.Error()
	}
	return "Entry saved securely."
}

func (a *App) GetEntries() []string {
	rows, err := a.db.Query("SELECT content FROM entries ORDER BY id DESC")
	if err != nil {
		return []string{"Error fetching entries"}
	}
	defer rows.Close()

	var entries []string
	for rows.Next() {
		var encryptedBlob []byte
		rows.Scan(&encryptedBlob)
		decrypted, _ := a.decrypt(encryptedBlob)
		entries = append(entries, decrypted)
	}
	return entries
}

func (a *App) AnalyzeJournal(entryText string) string {
	url := "http://localhost:11434/api/generate"
	
	// system prompt
	prompt := fmt.Sprintf("You are an empathetic mental health coach. Analyze this journal entry: '%s'. Provide a brief emotional summary and one small, actionable step. Keep it under 50 words.", entryText)

	requestBody, _ := json.Marshal(map[string]interface{}{
		"model":  "gemma:2b",
		"prompt": prompt,
		"stream": false,
	})

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		return "Error connecting to Ollama. Is it running?"
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if response, ok := result["response"].(string); ok {
		return response
	}
	return "No response from AI."
}