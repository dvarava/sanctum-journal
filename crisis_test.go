package main

import (
	"testing"
)

func TestCanonicalEmotionModelName(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"legacy emollm tag", "emollm:7b", "guanxin/emollm:latest"},
		{"legacy latest tag", "emollm:latest", "guanxin/emollm:latest"},
		{"empty model", "", "default"},
		{"custom model", "my-local-emotion-model", "my-local-emotion-model"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := canonicalEmotionModelName(tt.in); got != tt.want {
				t.Fatalf("canonicalEmotionModelName(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestCrisisDetection_HighSeverity(t *testing.T) {
	app := NewApp()

	tests := []struct {
		name       string
		input      string
		wantCrisis bool
		wantSev    string
	}{
		// HIGH severity — should trigger
		{"suicidal ideation", "I want to kill myself", true, "high"},
		{"end my life", "I just want to end my life", true, "high"},
		{"suicide keyword", "I've been thinking about suicide", true, "high"},
		{"self-harm", "I keep cutting myself", true, "high"},
		{"self harm variant", "I've been self-harming again", true, "high"},
		{"goodbye note", "This is my goodbye letter to everyone", true, "high"},
		{"overdose", "thinking about overdose", true, "high"},

		// MODERATE severity
		{"burden", "I am a burden to everyone around me", true, "moderate"},
		{"cant take it", "I can't take it anymore", true, "moderate"},

		// Should NOT trigger — safe everyday language
		{"doctor visit", "I went to the doctor today for a checkup", false, ""},
		{"medication", "I took my medication this morning and felt better", false, ""},
		{"pill", "I took a vitamin pill today", false, ""},
		{"feeling sad", "I'm feeling really sad today about my breakup", false, ""},
		{"stressed", "Work has been incredibly stressful this week", false, ""},
		{"angry", "I'm so angry at my boss for what happened", false, ""},
		{"empty entry", "", false, ""},
		{"normal journal", "Today was a great day. I went for a walk in the park and felt at peace.", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := app.CheckCrisisMarkers(tt.input)
			if result.IsCrisis != tt.wantCrisis {
				t.Errorf("CheckCrisisMarkers(%q): IsCrisis = %v, want %v", tt.input, result.IsCrisis, tt.wantCrisis)
			}
			if result.Severity != tt.wantSev {
				t.Errorf("CheckCrisisMarkers(%q): Severity = %q, want %q", tt.input, result.Severity, tt.wantSev)
			}
		})
	}
}

func TestCrisisDetection_DoesNotBlockNormalMedical(t *testing.T) {
	app := NewApp()

	safeInputs := []string{
		"I took my prescription from the pharmacy",
		"My doctor said I'm doing well",
		"I need to refill my medication",
		"I'm taking pills for my allergies",
		"I had a medical appointment today",
	}

	for _, input := range safeInputs {
		t.Run(input, func(t *testing.T) {
			result := app.CheckCrisisMarkers(input)
			if result.IsCrisis {
				t.Errorf("CheckCrisisMarkers(%q): incorrectly flagged as crisis (patterns: %v)", input, result.Patterns)
			}
		})
	}
}
