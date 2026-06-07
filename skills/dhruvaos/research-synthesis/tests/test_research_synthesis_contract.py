from pathlib import Path


SKILL = Path(__file__).resolve().parents[1] / "SKILL.md"
TEXT = SKILL.read_text()


def test_research_synthesis_is_brain_first():
    assert "Brain-first" in TEXT
    assert 'gbrain search "[topic]"' in TEXT
    assert "Search GBrain First" in TEXT


def test_research_synthesis_ingests_before_discord():
    ingest_index = TEXT.index("## Step 6")
    discord_index = TEXT.index("## Step 7")
    assert ingest_index < discord_index
    assert "BEFORE Discord post" in TEXT
    assert "embed --stale" in TEXT
    assert "flock -n ~/.gbrain/gbrain-write.lock" in TEXT


def test_research_synthesis_limits_discord_message_size():
    assert "Keep under 1800 characters" in TEXT
    assert "#research" in TEXT
    assert "outbound: false" in TEXT


def test_research_synthesis_slug_is_path_safe():
    assert 're.sub(r"[^a-z0-9]+"' in TEXT
    assert "Path(\"~/brain/resources\").expanduser().resolve()" in TEXT
    assert "Unsafe research output path" in TEXT
