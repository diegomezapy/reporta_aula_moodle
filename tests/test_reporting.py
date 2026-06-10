from app.models import Participant, ParticipationRow, TableRow
from app.reporting import apply_desertion_risk, build_activity_summary, build_student_summaries, build_tutor_summary


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


def test_tutor_summary_and_desertion_risk_are_added_to_students():
    participants = [Participant(user_id="20", name="Luis Vera", email="luis@example.com", last_access="Nunca")]
    summaries = build_student_summaries(participants, [], [])
    tutor_rows = [ParticipationRow(activity_cmid="1", activity_name="Foro", action="mensajes", role_id="3", role_name="Docente", user_id="9", student_name="Tutora", count=5)]

    tutor_summary = build_tutor_summary(tutor_rows, activities_count=8)
    enriched = apply_desertion_risk(summaries, tutor_summary)

    assert tutor_summary.active_tutors == 1
    assert tutor_summary.actions_registered == 5
    assert tutor_summary.participation_level == "Baja"
    assert enriched[0].desertion_probability >= 0.7
    assert enriched[0].desertion_risk_level == "Critico"
    assert enriched[0].follow_up_alert is True
