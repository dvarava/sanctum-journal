package main

import "testing"

func TestAnalysisAuditRoundTrip(t *testing.T) {
	app := newTestVaultApp(t)
	if result := app.SetupVaultPassword("audit trail password", "audit trail password"); !result.Success {
		t.Fatalf("SetupVaultPassword() = %+v, want success", result)
	}

	err := app.recordAnalysisAudit(AnalysisAuditEvent{
		EntryID:        42,
		Mode:           "local",
		ModelName:      "qwen3:4b",
		EmotionModel:   "guanxin/emollm:latest",
		DataLeftDevice: false,
		CrisisDetected: false,
		Purpose:        "journal_analysis",
	})
	if err != nil {
		t.Fatalf("recordAnalysisAudit() error = %v", err)
	}

	events := app.GetAnalysisAudit(10)
	if len(events) != 1 {
		t.Fatalf("GetAnalysisAudit() length = %d, want 1", len(events))
	}

	got := events[0]
	if got.EntryID != 42 ||
		got.Mode != "local" ||
		got.ModelName != "qwen3:4b" ||
		got.EmotionModel != "guanxin/emollm:latest" ||
		got.DataLeftDevice ||
		got.CrisisDetected ||
		got.Purpose != "journal_analysis" ||
		got.CreatedAt == "" {
		t.Fatalf("audit event = %+v, want saved local analysis metadata", got)
	}
}

func TestCrisisRegionNormalization(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", "global"},
		{"US", "us"},
		{"uk/ie", "uk_ie"},
		{"ireland", "uk_ie"},
		{"unknown", "global"},
	}

	for _, tt := range tests {
		if got := normalizeCrisisRegion(tt.in); got != tt.want {
			t.Fatalf("normalizeCrisisRegion(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
