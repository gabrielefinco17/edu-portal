-- --------------------------------- TABLES ---------------------------------

CREATE TABLE account(
    email        VARCHAR(40) PRIMARY KEY, 
    user_name    VARCHAR(40) NOT NULL,
    user_surname VARCHAR(40) NOT NULL,
    user_role    VARCHAR(20) NOT NULL,
    department   VARCHAR(20),

    CONSTRAINT check_role
        CHECK (user_role IN ('teacher', 'principal'))
);


CREATE TABLE meeting(
    id                SERIAL PRIMARY KEY,
    meeting_date      DATE NOT NULL,
    start_time        TIME NOT NULL,
    end_time          TIME,
    president_email   VARCHAR(40),

    CONSTRAINT fk_president
        FOREIGN KEY (president_email)
        REFERENCES account(email)
        ON DELETE SET NULL,

    CONSTRAINT check_time
        CHECK (end_time > start_time)
);


CREATE TABLE proposal(
    id                   SERIAL PRIMARY KEY,
    title                VARCHAR(100) NOT NULL,
    proposal_description TEXT,
    attachment           TEXT,
    meeting_id           INTEGER NOT NULL,

    CONSTRAINT fk_proposal_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meeting(id)
        ON DELETE CASCADE
);


CREATE TABLE token(
    code         VARCHAR(100) PRIMARY KEY,
    generated_at TIMESTAMP NOT NULL,
    expires_at   TIMESTAMP NOT NULL,
    user_email   VARCHAR(40) NOT NULL,
    meeting_id   INTEGER NOT NULL,

    CONSTRAINT fk_token_user
        FOREIGN KEY (user_email)
        REFERENCES account(email)
        ON DELETE CASCADE,

    CONSTRAINT fk_token_meeting 
        FOREIGN KEY (meeting_id)
        REFERENCES meeting(id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_expiration
        CHECK (expires_at > generated_at),

    CONSTRAINT unique_token_in_meeting 
        UNIQUE (user_email, meeting_id)
);


CREATE TABLE participation(
    meeting_id INTEGER,
    user_email VARCHAR(40),

    PRIMARY KEY (meeting_id, user_email),

    CONSTRAINT fk_participation_meeting
        FOREIGN KEY (meeting_id) 
        REFERENCES meeting(id) 
        ON DELETE CASCADE,

    CONSTRAINT fk_participation_user
        FOREIGN KEY (user_email)
        REFERENCES account(email)
        ON DELETE CASCADE
);

CREATE TABLE vote(
    account_email VARCHAR(40),
    proposal_id   INT,
    preference    INT NOT NULL,

    PRIMARY KEY (account_email, proposal_id),

    CONSTRAINT preference_options
        CHECK (preference IN ( 0, 1, 2)),

    CONSTRAINT fk_account_email
        FOREIGN KEY (account_email)
        REFERENCES account(email),

    CONSTRAINT fk_proposal_id
        FOREIGN KEY (proposal_id)
        REFERENCES proposal(id)
);


-- --------------------------------- ROLES ---------------------------------

CREATE ROLE teacher LOGIN PASSWORD 'praga';
GRANT SELECT ON meeting, proposal, account TO teacher;
GRANT SELECT, INSERT, UPDATE ON participation TO teacher;
GRANT SELECT, INSERT ON vote TO teacher;
GRANT SELECT ON token TO teacher;

-- CREATE ROLE secretary LOGIN PASSWORD 'praga';
-- GRANT SELECT ON meeting, account TO secretary;
-- GRANT SELECT, INSERT ON participation TO secretary;
-- GRANT SELECT, INSERT, UPDATE (title, proposal_description, attachment) ON proposal TO secretary;
-- GRANT USAGE ON SEQUENCE proposal_id_seq TO secretary;   -- fundamental for INSERT INTO
-- GRANT SELECT, INSERT ON token TO secretary;


CREATE ROLE principal LOGIN PASSWORD 'praga';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO principal;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO principal;


-- ----------------------------- FILLING QUERIES -----------------------------

-- ================================= ACCOUNT =================================

INSERT INTO account (email, user_name, user_surname, user_role, department) VALUES
('mario.rossi@school.it',      'Mario',     'Rossi',      'principal', NULL),
('giulia.bianchi@school.it',   'Giulia',    'Bianchi',    'principal', NULL),
('luca.ferrari@school.it',     'Luca',      'Ferrari',    'teacher',   'Mathematics'),
('anna.conti@school.it',       'Anna',      'Conti',      'teacher',   'Science'),
('roberto.mancini@school.it',  'Roberto',   'Mancini',    'teacher',   'History'),
('elena.ricci@school.it',      'Elena',     'Ricci',      'teacher',   'Literature'),
('marco.gallo@school.it',      'Marco',     'Gallo',      'teacher',   'Physics'),
('sofia.marino@school.it',     'Sofia',     'Marino',     'teacher',   'Art'),
('davide.esposito@school.it',  'Davide',    'Esposito',   'teacher',   'Music'),
('chiara.lombardi@school.it',  'Chiara',    'Lombardi',   'teacher',   'Geography'),
('paolo.greco@school.it',      'Paolo',     'Greco',      'teacher',   'PE'),
('francesca.bruno@school.it',  'Francesca', 'Bruno',      'teacher',   'English'),
('antonio.romano@school.it',   'Antonio',   'Romano',     'teacher',   'Chemistry'),
('valentina.sala@school.it',   'Valentina', 'Sala',       'teacher',   'Philosophy'),
('giorgio.costa@school.it',    'Giorgio',   'Costa',      'teacher',   'ICT');


-- ================================= MEETING =================================

INSERT INTO meeting (meeting_date, start_time, end_time, president_email) VALUES
('2025-01-10', '09:00', '11:00', 'mario.rossi@school.it'),
('2025-02-14', '10:00', '12:30', 'giulia.bianchi@school.it'),
('2025-03-05', '14:00', '16:00', 'mario.rossi@school.it'),
('2025-03-20', '09:30', '11:30', 'giulia.bianchi@school.it'),
('2025-04-08', '15:00', '17:00', 'mario.rossi@school.it'),
('2025-04-25', '10:00', '12:00', 'giulia.bianchi@school.it'),
('2025-05-06', '09:00', '10:30', 'mario.rossi@school.it'),
('2025-05-21', '14:30', '16:30', 'giulia.bianchi@school.it'),
('2025-06-03', '11:00', '13:00', 'mario.rossi@school.it'),
('2025-06-18', '09:00', '11:00', 'giulia.bianchi@school.it'),
('2025-09-10', '10:00', '12:00', 'mario.rossi@school.it'),
('2025-10-02', '14:00', '15:30', 'giulia.bianchi@school.it'),
('2025-10-30', '09:00', '11:30', 'mario.rossi@school.it'),
('2025-11-20', '10:30', '12:30', 'giulia.bianchi@school.it'),
('2025-12-10', '09:00', '11:00', 'mario.rossi@school.it');


-- ================================= PROPOSAL =================================

INSERT INTO proposal (title, proposal_description, attachment, meeting_id) VALUES
('New Lab Equipment',         'Purchase microscopes and chemistry kits for the science lab.',     'lab_budget.pdf',       1),
('School Trip to Rome',       'Organize a two-day cultural trip to Rome for all students.',       'rome_itinerary.pdf',   1),
('Library Renovation',        'Refurbish the school library with new furniture and books.',       NULL,                   2),
('Anti-Bullying Program',     'Introduce a structured program to prevent bullying.',              'program_guide.pdf',    2),
('Digital Classroom Upgrade', 'Replace old projectors with interactive smart boards.',           'tech_offer.pdf',       3),
('Sports Day 2025',           'Organize the annual inter-class sports competition.',             NULL,                   3),
('Cafeteria Menu Revision',   'Update the cafeteria menu to include more healthy options.',      'menu_proposal.pdf',    4),
('Teacher Training Day',      'Schedule a full-day professional development session.',           'agenda.pdf',           4),
('Outdoor Garden Project',    'Create a small student-managed garden on school grounds.',        NULL,                   5),
('Extra Math Support',        'Offer after-school math tutoring for struggling students.',       NULL,                   5),
('End-of-Year Ceremony',      'Plan the end-of-year awards and graduation ceremony.',            'ceremony_plan.pdf',    6),
('Recycling Initiative',      'Place color-coded recycling bins in all classrooms.',             'eco_plan.pdf',         7),
('New Grading Policy',        'Revise the grading rubric to align with national standards.',     'rubric_draft.pdf',     8),
('Parent-Teacher Conference', 'Schedule two mandatory parent-teacher conferences per year.',     NULL,                   9),
('Emergency Exit Drill',      'Conduct a mandatory safety and evacuation drill for all staff.',  'safety_protocol.pdf',  10);


-- ================================= TOKEN =================================

INSERT INTO token (code, generated_at, expires_at, user_email, meeting_id) VALUES
('TOK-A1B2C3', '2025-01-09 08:00:00', '2025-01-10 12:00:00', 'luca.ferrari@school.it',    1),
('TOK-D4E5F6', '2025-01-09 08:00:00', '2025-01-10 12:00:00', 'anna.conti@school.it',      1),
('TOK-G7H8I9', '2025-01-09 08:00:00', '2025-01-10 12:00:00', 'roberto.mancini@school.it', 1),
('TOK-J1K2L3', '2025-02-13 09:00:00', '2025-02-14 13:00:00', 'elena.ricci@school.it',     2),
('TOK-M4N5O6', '2025-02-13 09:00:00', '2025-02-14 13:00:00', 'marco.gallo@school.it',     2),
('TOK-P7Q8R9', '2025-03-04 10:00:00', '2025-03-05 17:00:00', 'sofia.marino@school.it',    3),
('TOK-S1T2U3', '2025-03-04 10:00:00', '2026-03-05 17:00:00', 'davide.esposito@school.it', 3),
('TOK-V4W5X6', '2025-03-19 08:30:00', '2026-07-20 12:00:00', 'chiara.lombardi@school.it', 4),
('TOK-Y7Z8A1', '2025-03-19 08:30:00', '2026-07-20 12:00:00', 'paolo.greco@school.it',     4),
('TOK-B2C3D4', '2025-04-07 14:00:00', '2026-08-08 18:00:00', 'francesca.bruno@school.it', 5),
('TOK-E5F6G7', '2025-04-07 14:00:00', '2026-09-08 18:00:00', 'antonio.romano@school.it',  5),
('TOK-H8I9J1', '2025-04-24 09:00:00', '2026-09-25 13:00:00', 'valentina.sala@school.it',  6),
('TOK-K2L3M4', '2025-04-24 09:00:00', '2026-09-25 13:00:00', 'giorgio.costa@school.it',   6),
('TOK-N5O6P7', '2025-05-05 08:00:00', '2026-09-06 11:00:00', 'luca.ferrari@school.it',    7),
('TOK-Q8R9S1', '2025-05-20 13:00:00', '2026-09-21 17:00:00', 'anna.conti@school.it',      8),
('TOK-PRINCIPAL-TEST', NOW(), NOW() + INTERVAL '60 days', 'mario.rossi@school.it', 11),
('TOK-TEACHER-LOGIN', NOW(), NOW() + INTERVAL '60 days', 'giorgio.costa@school.it', 11),
('TOK-LOGOUT-TEST', NOW(), NOW() + INTERVAL '60 days', 'elena.ricci@school.it', 11),
('TOK-PRINCIPAL-TEST2', NOW(), NOW() + INTERVAL '60 days', 'giulia.bianchi@school.it', 12);


-- =============================== PARTICIPATION ===============================

INSERT INTO participation (meeting_id, user_email) VALUES
(1, 'mario.rossi@school.it'),
(1, 'luca.ferrari@school.it'),
(1, 'anna.conti@school.it'),
(1, 'roberto.mancini@school.it'),
(2, 'giulia.bianchi@school.it'),
(2, 'elena.ricci@school.it'),
(2, 'marco.gallo@school.it'),
(3, 'mario.rossi@school.it'),
(3, 'sofia.marino@school.it'),
(3, 'davide.esposito@school.it'),
(4, 'giulia.bianchi@school.it'),
(4, 'chiara.lombardi@school.it'),
(4, 'paolo.greco@school.it'),
(5, 'mario.rossi@school.it'),
(5, 'francesca.bruno@school.it'),
(5, 'antonio.romano@school.it'),
(6, 'giulia.bianchi@school.it'),
(6, 'valentina.sala@school.it'),
(6, 'giorgio.costa@school.it'),
(7, 'mario.rossi@school.it'),
(7, 'luca.ferrari@school.it'),
(8, 'giulia.bianchi@school.it'),
(8, 'anna.conti@school.it'),
(9, 'mario.rossi@school.it'),
(9, 'roberto.mancini@school.it'),
(10, 'giulia.bianchi@school.it'),
(10, 'elena.ricci@school.it'),
(10, 'marco.gallo@school.it');


-- ================================== VOTE ==================================

-- preference: 0 = against, 1 = abstain, 2 = in favour
INSERT INTO vote (account_email, proposal_id, preference) VALUES
-- Proposal 1 (New Lab Equipment) — meeting 1 participants
('luca.ferrari@school.it',    1, 2),
('anna.conti@school.it',      1, 2),
('roberto.mancini@school.it', 1, 1),
('mario.rossi@school.it',     1, 2),
-- Proposal 2 (School Trip to Rome) — meeting 1 participants
('luca.ferrari@school.it',    2, 2),
('anna.conti@school.it',      2, 0),
('roberto.mancini@school.it', 2, 2),
('mario.rossi@school.it',     2, 1),
-- Proposal 3 (Library Renovation) — meeting 2 participants
('elena.ricci@school.it',     3, 2),
('marco.gallo@school.it',     3, 2),
('giulia.bianchi@school.it',  3, 2),
-- Proposal 4 (Anti-Bullying Program) — meeting 2 participants
('elena.ricci@school.it',     4, 2),
('marco.gallo@school.it',     4, 1),
('giulia.bianchi@school.it',  4, 2),
-- Proposal 5 (Digital Classroom Upgrade) — meeting 3 participants
('sofia.marino@school.it',    5, 0),
('davide.esposito@school.it', 5, 2),
('mario.rossi@school.it',     5, 2),
-- Proposal 6 (Sports Day 2025) — meeting 3 participants
('sofia.marino@school.it',    6, 2),
('davide.esposito@school.it', 6, 2),
('mario.rossi@school.it',     6, 2),
-- Proposal 7 (Cafeteria Menu Revision) — meeting 4 participants
('chiara.lombardi@school.it', 7, 2),
('paolo.greco@school.it',     7, 2),
('giulia.bianchi@school.it',  7, 1),
-- Proposal 8 (Teacher Training Day) — meeting 4 participants
('chiara.lombardi@school.it', 8, 1),
('paolo.greco@school.it',     8, 0),
('giulia.bianchi@school.it',  8, 2),
-- Proposal 9 (Outdoor Garden Project) — meeting 5 participants
('francesca.bruno@school.it', 9, 2),
('antonio.romano@school.it',  9, 2),
('mario.rossi@school.it',     9, 1),
-- Proposal 10 (Extra Math Support) — meeting 5 participants
('francesca.bruno@school.it', 10, 2),
('antonio.romano@school.it',  10, 1),
('mario.rossi@school.it',     10, 2);