from app.models import Participant, ParticipationRow, TableRow
from app.bayesian import estimate_desertion_probability
from app.reporting import (
    apply_desertion_risk,
    build_activity_summary,
    build_student_summaries,
    build_tutor_summary,
    prior_map_from_previous_summaries,
)


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
    assert enriched[0].risk_model_version.startswith("bayes_lr")
    assert enriched[0].bayesian_prior_probability == 0.2
    assert enriched[0].bayesian_posterior_probability >= 0.7
    assert enriched[0].desertion_risk_level == "Critico"
    assert enriched[0].follow_up_alert is True


def test_bayesian_estimate_can_reduce_risk_when_evidence_is_positive():
    summary = build_student_summaries(
        [Participant(user_id="30", name="Marta Rojas", email="marta@example.com", last_access="1 dia 2 horas")],
        [TableRow(user_id="30", cells={"Nombre": "Marta Rojas", "Foro 1": "100", "Foro 2": "100", "Quiz 1": "95", "Quiz 2": "90", "Tarea": "90", "Total del curso": "95"})],
        [
            ParticipationRow(user_id="30", student_name="Marta Rojas", activity_name="Foro", action="mensajes", count=4),
            ParticipationRow(user_id="30", student_name="Marta Rojas", activity_name="Cuestionario", action="vista", count=90),
        ],
    )[0]
    tutor_summary = build_tutor_summary(
        [ParticipationRow(activity_cmid="1", activity_name="Foro", action="mensajes", role_id="3", role_name="Docente", user_id="9", student_name="Tutora", count=30)],
        activities_count=1,
    )

    estimate = estimate_desertion_probability(summary, tutor_summary, prior_probability=0.5)

    assert estimate.prior_probability == 0.5
    assert estimate.posterior_probability < 0.5
    assert "Alta participacion evaluativa" in estimate.evidence_factors


def test_previous_posterior_is_used_as_next_prior():
    participant = Participant(user_id="40", name="Rosa Diaz", email="rosa@example.com", last_access="20 dias")
    summaries = build_student_summaries([participant], [], [])
    tutor_summary = build_tutor_summary([], activities_count=3)
    first_week = apply_desertion_risk(summaries, tutor_summary)
    priors = prior_map_from_previous_summaries(first_week)
    second_week = apply_desertion_risk(summaries, tutor_summary, priors)

    assert priors["40"] == first_week[0].bayesian_posterior_probability
    assert second_week[0].bayesian_prior_probability == first_week[0].bayesian_posterior_probability
