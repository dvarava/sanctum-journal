package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestVaultApp(t *testing.T) *App {
	t.Helper()

	dir := t.TempDir()
	dbPath := filepath.Join(dir, "sanctum_test.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}

	app := NewApp()
	app.db = db
	app.dbPath = dbPath
	app.sanctumDir = dir
	app.embedText = func(text string) []float64 {
		if strings.Contains(strings.ToLower(text), "other") {
			return []float64{0, 1, 0}
		}
		return []float64{1, 0, 0}
	}

	if err := app.ensureDatabaseSchema(); err != nil {
		t.Fatalf("ensureDatabaseSchema() error = %v", err)
	}

	t.Cleanup(func() {
		app.clearSecretKey()
		_ = db.Close()
	})

	return app
}

func countBackupFiles(t *testing.T, app *App) int {
	t.Helper()

	files, err := os.ReadDir(filepath.Join(app.sanctumDir, "backups"))
	if err != nil {
		if os.IsNotExist(err) {
			return 0
		}
		t.Fatalf("ReadDir(backups) error = %v", err)
	}

	count := 0
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".db") {
			count++
		}
	}
	return count
}

func TestVaultSetupUnlockAndWrongPassword(t *testing.T) {
	app := newTestVaultApp(t)

	if status := app.GetVaultStatus(); status.Configured || status.Unlocked {
		t.Fatalf("initial status = %+v, want unconfigured and locked", status)
	}

	result := app.SetupVaultPassword("correct horse battery", "correct horse battery")
	if !result.Success || !result.Status.Configured || !result.Status.Unlocked {
		t.Fatalf("SetupVaultPassword() = %+v, want success and unlocked", result)
	}

	app.LockVault()
	if status := app.GetVaultStatus(); !status.Configured || status.Unlocked {
		t.Fatalf("status after LockVault = %+v, want configured and locked", status)
	}

	result = app.UnlockVault("wrong password")
	if result.Success || result.Status.Unlocked {
		t.Fatalf("UnlockVault(wrong) = %+v, want failure and locked", result)
	}
	if _, err := app.currentSecretKey(); err == nil {
		t.Fatal("currentSecretKey() error = nil after wrong password, want locked")
	}

	result = app.UnlockVault("correct horse battery")
	if !result.Success || !result.Status.Unlocked {
		t.Fatalf("UnlockVault(correct) = %+v, want success and unlocked", result)
	}
}

func TestSetupArchivesAndClearsPrototypeEntries(t *testing.T) {
	app := newTestVaultApp(t)

	_, _ = app.db.Exec("DROP TABLE entries;")
	_, err := app.db.Exec(`CREATE TABLE entries (
		id INTEGER PRIMARY KEY,
		title TEXT DEFAULT '',
		content BLOB,
		emotions TEXT DEFAULT '[]',
		coaching TEXT DEFAULT '',
		embedding TEXT DEFAULT '[]',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`)
	if err != nil {
		t.Fatalf("create legacy entries table error = %v", err)
	}
	if _, err := app.db.Exec("INSERT INTO entries (title, content, emotions, coaching, embedding) VALUES (?, ?, ?, ?, ?)", "Legacy", []byte("legacy ciphertext"), `["Sad"]`, "coach", "[1]"); err != nil {
		t.Fatalf("insert legacy entry error = %v", err)
	}

	result := app.SetupVaultPassword("fresh vault password", "fresh vault password")
	if !result.Success {
		t.Fatalf("SetupVaultPassword() = %+v, want success", result)
	}

	var count int
	if err := app.db.QueryRow("SELECT COUNT(*) FROM entries").Scan(&count); err != nil {
		t.Fatalf("count entries error = %v", err)
	}
	if count != 0 {
		t.Fatalf("entries count after setup = %d, want 0", count)
	}
	if backups := countBackupFiles(t, app); backups == 0 {
		t.Fatal("backup count = 0, want setup to archive prototype database")
	}
}

func TestEncryptedEntriesRoundTripAndNoPlaintext(t *testing.T) {
	app := newTestVaultApp(t)
	if result := app.SetupVaultPassword("round trip password", "round trip password"); !result.Success {
		t.Fatalf("SetupVaultPassword() = %+v, want success", result)
	}

	message := app.SaveEntry(0, "Raw Title", "Secret content belongs in the vault", []string{" anxious "}, "Private coaching")
	if !strings.Contains(message, "saved") {
		t.Fatalf("SaveEntry() = %q, want saved", message)
	}

	entries := app.GetEntries()
	if len(entries) != 1 {
		t.Fatalf("GetEntries() length = %d, want 1", len(entries))
	}
	if entries[0].Title != "Raw Title" || entries[0].Content != "Secret content belongs in the vault" {
		t.Fatalf("entry round trip = %+v", entries[0])
	}
	if len(entries[0].Emotions) != 1 || entries[0].Emotions[0] != "Anxious" {
		t.Fatalf("entry emotions = %v, want [Anxious]", entries[0].Emotions)
	}

	var raw []byte
	if err := app.db.QueryRow("SELECT payload FROM entries LIMIT 1").Scan(&raw); err != nil {
		t.Fatalf("read raw payload error = %v", err)
	}
	rawText := string(raw)
	for _, leaked := range []string{"Raw Title", "Secret content", "Anxious", "Private coaching"} {
		if strings.Contains(rawText, leaked) {
			t.Fatalf("encrypted payload leaked %q in raw database bytes", leaked)
		}
	}

	app.LockVault()
	if got := app.GetEntries(); len(got) != 0 {
		t.Fatalf("GetEntries() while locked length = %d, want 0", len(got))
	}
	if message := app.SaveEntry(0, "Locked", "Nope", nil, ""); !strings.Contains(message, "locked") {
		t.Fatalf("SaveEntry() while locked = %q, want locked message", message)
	}
}

func TestChangeVaultPasswordPreservesEntries(t *testing.T) {
	app := newTestVaultApp(t)
	if result := app.SetupVaultPassword("old vault password", "old vault password"); !result.Success {
		t.Fatalf("SetupVaultPassword() = %+v, want success", result)
	}
	app.SaveEntry(0, "Keep Me", "This entry should survive password rotation.", []string{"steady"}, "Keep going")

	result := app.ChangeVaultPassword("old vault password", "new vault password", "new vault password")
	if !result.Success || !result.Status.Unlocked {
		t.Fatalf("ChangeVaultPassword() = %+v, want success and unlocked", result)
	}

	app.LockVault()
	if result := app.UnlockVault("old vault password"); result.Success {
		t.Fatalf("UnlockVault(old) = %+v, want failure", result)
	}
	if result := app.UnlockVault("new vault password"); !result.Success {
		t.Fatalf("UnlockVault(new) = %+v, want success", result)
	}

	entries := app.GetEntries()
	if len(entries) != 1 || entries[0].Title != "Keep Me" {
		t.Fatalf("entries after password change = %+v, want preserved entry", entries)
	}
}

func TestResetVaultArchivesAndClearsEntries(t *testing.T) {
	app := newTestVaultApp(t)
	if result := app.SetupVaultPassword("first vault password", "first vault password"); !result.Success {
		t.Fatalf("SetupVaultPassword() = %+v, want success", result)
	}
	app.SaveEntry(0, "Reset Me", "This entry should be archived and cleared.", nil, "")

	before := countBackupFiles(t, app)
	result := app.ResetVault("second vault password", "second vault password")
	if !result.Success || !result.Status.Unlocked {
		t.Fatalf("ResetVault() = %+v, want success and unlocked", result)
	}
	if entries := app.GetEntries(); len(entries) != 0 {
		t.Fatalf("entries after reset length = %d, want 0", len(entries))
	}
	if after := countBackupFiles(t, app); after <= before {
		t.Fatalf("backup count after reset = %d, before = %d, want a new backup", after, before)
	}
}
