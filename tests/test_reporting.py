from app.models import Participant, ParticipationRow, TableRow
from app.reporting import build_activity_summary, build_student_summaries


def test_build_student_summaries_classifies_activity_and_grades():
    participants = [Participant(user_id="10", name="Ana Lopez", email="ana@example.com")]
    grade_rows = [TableRow(user_id="10", cells={"Nombre": "Ana Lopez", "Foro 1": "100", "Total del curso": "95"})]
    participation_rows = [
        ParticipationRow(user_id="10", student_name="Ana Lopez", activity_name="Foro unidad 1", action="mensajes", count=3),
        ParticipationRow(user_id="10", student_name="Ana Lopez", activity_name="Cuestionario", action="vista", count=30),
    ]

    summaries = build_student_summaries(participants, grade_rows, participation_rows)

    assert len(summaries) == 1
    assert summaries[0].actions_registered == 33
    assert summaries[0].forum_posts == 3
    assert summaries[0].course_total == "95"
    assert summaries[0].platform_level == "Media"
    assert summaries[0].evaluative_level == "Media"


def test_build_activity_summary_groups_by_activity_and_action():
    rows = [
        ParticipationRow(activity_cmid="1", activity_name="Foro", action="mensajes", count=2),
        ParticipationRow(activity_cmid="1", activity_name="Foro", action="mensajes", count=5),
    ]

    summary = build_activity_summary(rows)

    assert summary == [{"activity_cmid": "1", "activity_name": "Foro", "action": "mensajes", "count": 7}]

