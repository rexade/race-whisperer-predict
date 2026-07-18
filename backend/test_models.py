"""Tests for request body validation models."""
import pytest
from pydantic import ValidationError

from main import AnalysisIn, MaeIn, RawTimeCandidatesIn, RawTimesIn, WeightsIn


def test_analysis_valid():
    m = AnalysisIn(raceId="v75-1", raceNumber=3, analysisDate="2026-07-18", horses=[{"n": 1}])
    assert m.raceId == "v75-1"
    assert m.raceNumber == 3


def test_analysis_missing_race_id_rejected():
    with pytest.raises(ValidationError):
        AnalysisIn(raceNumber=3, analysisDate="2026-07-18", horses=[])


def test_analysis_non_int_race_number_rejected():
    with pytest.raises(ValidationError):
        AnalysisIn(raceId="x", raceNumber="three", analysisDate="2026-07-18", horses=[])


def test_rawtimes_defaults_schema_version():
    m = RawTimesIn(raceId="x", raceNumber=1, gameId="g", date="2026-07-18", rawTimes=[])
    assert m.schemaVersion == 6


def test_rawtimes_missing_game_id_rejected():
    with pytest.raises(ValidationError):
        RawTimesIn(raceId="x", raceNumber=1, date="2026-07-18", rawTimes=[])


def test_candidates_defaults_schema_version():
    m = RawTimeCandidatesIn(raceId="x", raceNumber=1, gameId="g", date="2026-07-18", candidateData={"horses": []})
    assert m.schemaVersion == 1


def test_mae_valid():
    m = MaeIn(raceId="x", raceNumber=1, analysisDate="2026-07-18", meanRankError=1.5, horseCount=12, horses=[])
    assert m.meanRankError == 1.5


def test_mae_missing_error_rejected():
    with pytest.raises(ValidationError):
        MaeIn(raceId="x", raceNumber=1, analysisDate="2026-07-18", horseCount=12, horses=[])


def test_weights_minimal():
    m = WeightsIn(weights={"postPosition": 1.0})
    assert m.postPositionCurves is None
    assert m.label is None


def test_weights_requires_weights():
    with pytest.raises(ValidationError):
        WeightsIn(label="no weights")
