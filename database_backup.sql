--
-- PostgreSQL database dump
--

\restrict 7dIgsZqaklitWhIe4sJABVxpgg1QMlcCqjdKAEBcaPKhg9NMysUqnRJ0UMq4cdm

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    date text NOT NULL,
    status text NOT NULL,
    check_in text,
    check_out text,
    note text,
    overtime_hours double precision,
    latitude double precision,
    longitude double precision,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.attendance OWNER TO postgres;

--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_id_seq OWNER TO postgres;

--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    admin_id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    role text NOT NULL,
    department text,
    salary numeric(12,2) NOT NULL,
    salary_type text DEFAULT 'monthly'::text NOT NULL,
    joining_date text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_balances (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    year integer NOT NULL,
    casual integer DEFAULT 12 NOT NULL,
    sick integer DEFAULT 7 NOT NULL,
    earned integer DEFAULT 15 NOT NULL,
    casual_used integer DEFAULT 0 NOT NULL,
    sick_used integer DEFAULT 0 NOT NULL,
    earned_used integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leave_balances OWNER TO postgres;

--
-- Name: leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_balances_id_seq OWNER TO postgres;

--
-- Name: leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;


--
-- Name: leaves; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leaves (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    type text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    days integer DEFAULT 1 NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by integer,
    approver_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leaves OWNER TO postgres;

--
-- Name: leaves_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leaves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leaves_id_seq OWNER TO postgres;

--
-- Name: leaves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leaves_id_seq OWNED BY public.leaves.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    type text NOT NULL,
    method text NOT NULL,
    month integer,
    year integer,
    note text,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    employee_id integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date text,
    proof_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    company_name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: leave_balances id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);


--
-- Name: leaves id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaves ALTER COLUMN id SET DEFAULT nextval('public.leaves_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance (id, employee_id, date, status, check_in, check_out, note, overtime_hours, latitude, longitude, created_at) FROM stdin;
1	1	2026-04-01	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.243129
2	2	2026-04-01	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.24887
3	3	2026-04-01	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.253298
4	4	2026-04-01	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.257087
5	5	2026-04-01	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.260222
6	1	2026-04-02	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.267922
7	2	2026-04-02	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.272051
8	3	2026-04-02	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.275024
9	4	2026-04-02	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.279258
10	5	2026-04-02	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.282458
11	1	2026-04-03	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.290593
12	2	2026-04-03	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.293264
13	3	2026-04-03	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.296256
14	4	2026-04-03	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.300182
15	5	2026-04-03	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.303548
16	1	2026-04-06	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.310144
17	2	2026-04-06	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.313096
18	3	2026-04-06	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.316352
19	4	2026-04-06	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.319841
20	5	2026-04-06	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.323044
21	1	2026-04-07	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.330433
22	2	2026-04-07	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.333356
23	3	2026-04-07	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.33725
24	4	2026-04-07	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.340145
25	5	2026-04-07	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.343187
26	1	2026-04-08	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.349128
27	2	2026-04-08	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.352262
28	3	2026-04-08	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.355481
29	4	2026-04-08	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.358336
30	5	2026-04-08	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.361499
36	1	2026-04-10	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.384806
37	2	2026-04-10	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.388098
38	3	2026-04-10	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.391449
39	4	2026-04-10	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.394605
40	5	2026-04-10	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.397709
41	1	2026-04-13	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.404246
42	2	2026-04-13	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.40758
43	3	2026-04-13	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.410367
44	4	2026-04-13	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.412766
45	5	2026-04-13	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.416222
46	1	2026-04-14	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.421851
47	2	2026-04-14	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.424988
48	3	2026-04-14	absent	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.427728
49	4	2026-04-14	half_day	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.431032
50	5	2026-04-14	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.433836
75	7	2026-04-18	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:25.998229
76	1	2026-04-17	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:30.933448
77	2	2026-04-17	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:30.937703
78	3	2026-04-17	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:30.940818
79	4	2026-04-17	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:30.944713
80	5	2026-04-17	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:30.948632
81	6	2026-04-17	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:30.952235
56	1	2026-04-16	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.455935
57	2	2026-04-16	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.458971
58	3	2026-04-16	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.462263
59	4	2026-04-16	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.464697
60	5	2026-04-16	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.467091
51	1	2026-04-15	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.439087
52	2	2026-04-15	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.441887
53	3	2026-04-15	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.444858
54	4	2026-04-15	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.448309
55	5	2026-04-15	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.45084
61	6	2026-04-15	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:46.628801
31	1	2026-04-09	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.367028
32	2	2026-04-09	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.369571
33	3	2026-04-09	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.372755
34	4	2026-04-09	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.375222
35	5	2026-04-09	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:04:08.377826
62	6	2026-04-09	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:52.694287
63	1	2026-04-11	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:57.161239
64	2	2026-04-11	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:58.926243
65	3	2026-04-11	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:58.929879
66	4	2026-04-11	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:58.934109
67	5	2026-04-11	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:58.937204
68	6	2026-04-11	present	\N	\N	\N	\N	\N	\N	2026-04-16 03:51:58.940782
69	1	2026-04-18	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:25.936163
70	2	2026-04-18	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:25.979624
71	3	2026-04-18	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:25.985066
72	4	2026-04-18	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:25.988177
73	5	2026-04-18	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:25.991995
74	6	2026-04-18	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:25.994983
82	7	2026-04-17	present	\N	\N	\N	\N	\N	\N	2026-04-18 05:47:30.964236
83	1	2026-04-24	present	\N	\N	\N	\N	\N	\N	2026-04-24 07:49:39.495283
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, admin_id, name, phone, email, role, department, salary, salary_type, joining_date, status, created_at) FROM stdin;
1	1	Priya Patel	9876543210	priya@techco.com	Developer	Engineering	65000.00	monthly	2023-01-15	active	2026-04-16 03:04:08.205019
2	1	Arjun Kumar	9876543211	arjun@techco.com	Designer	Design	55000.00	monthly	2023-03-01	active	2026-04-16 03:04:08.212563
3	1	Meera Joshi	9876543212	\N	Manager	Operations	80000.00	monthly	2022-06-10	active	2026-04-16 03:04:08.218621
4	1	Ravi Singh	9876543213	\N	Sales Executive	Sales	800.00	daily	2023-07-20	active	2026-04-16 03:04:08.226199
5	1	Ananya Rao	9876543214	ananya@techco.com	HR	Human Resources	50000.00	monthly	2023-05-01	active	2026-04-16 03:04:08.232571
6	1	Harsh	1234581897581751	123@gmail.com	Developer	\N	150000.00	monthly	2026-04-16	active	2026-04-16 03:23:13.222802
7	1	123	12345162713	harsh.allegient@gmail.com	Developer	\N	490000.00	monthly	2026-04-17	active	2026-04-17 09:14:38.909523
\.


--
-- Data for Name: leave_balances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_balances (id, employee_id, year, casual, sick, earned, casual_used, sick_used, earned_used, updated_at) FROM stdin;
1	1	2026	12	7	15	0	0	0	2026-04-17 09:11:13.424005
2	2	2026	12	7	15	0	0	0	2026-04-17 09:11:13.426028
3	4	2026	12	7	15	0	0	0	2026-04-17 09:11:13.435538
4	3	2026	12	7	15	0	0	0	2026-04-17 09:11:13.435974
5	6	2026	12	7	15	0	0	0	2026-04-17 09:11:13.437371
6	5	2026	12	7	15	0	0	0	2026-04-17 09:11:13.437697
7	7	2026	12	7	15	0	0	0	2026-04-17 09:15:23.119141
\.


--
-- Data for Name: leaves; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leaves (id, employee_id, type, start_date, end_date, days, reason, status, approved_by, approver_note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, employee_id, amount, type, method, month, year, note, status, paid_at, created_at) FROM stdin;
1	1	65000.00	salary	bank	4	2026	April salary paid	paid	2026-04-16 03:04:08.472	2026-04-16 03:04:08.473181
2	2	20000.00	advance	upi	4	2026	Advance payment	paid	2026-04-16 03:04:08.478	2026-04-16 03:04:08.478584
3	3	80000.00	salary	bank	4	2026	April salary pending	pending	\N	2026-04-16 03:04:08.483789
4	4	5000.00	bonus	cash	4	2026	Performance bonus	paid	2026-04-16 03:04:08.487	2026-04-16 03:04:08.488368
5	3	9878.00	salary	bank	4	2026	\N	paid	2026-04-16 03:25:07.163	2026-04-16 03:25:07.164561
6	4	6000.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:14.695	2026-04-16 03:46:14.695832
7	5	15833.33	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:17.205	2026-04-16 03:46:17.205614
8	3	10122.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:19.955	2026-04-16 03:46:19.95608
9	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:22.13	2026-04-16 03:46:22.130769
10	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:23.468	2026-04-16 03:46:23.468889
11	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:24.79	2026-04-16 03:46:24.791178
12	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:25.625	2026-04-16 03:46:25.625813
13	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:26.225	2026-04-16 03:46:26.226164
14	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:26.779	2026-04-16 03:46:26.779991
15	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:27.2	2026-04-16 03:46:27.200527
16	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:27.619	2026-04-16 03:46:27.619694
17	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:28.018	2026-04-16 03:46:28.019181
18	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:28.783	2026-04-16 03:46:28.783702
19	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-16 03:46:35.918	2026-04-16 03:46:35.918324
23	6	200000.00	salary	cash	4	2026	\N	paid	2026-04-16 03:49:21.969	2026-04-16 03:49:21.969328
24	6	20000.00	bonus	upi	4	2026	\N	paid	2026-04-17 09:03:05.23	2026-04-17 09:03:05.231068
25	5	1666.67	salary	bank	4	2026	April 2026 salary	paid	2026-04-17 09:06:48.111	2026-04-17 09:06:48.112663
26	4	800.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-17 09:06:50.125	2026-04-17 09:06:50.125592
27	3	5333.33	salary	bank	4	2026	April 2026 salary	paid	2026-04-17 09:06:52.062	2026-04-17 09:06:52.062515
28	2	1083.33	salary	bank	4	2026	April 2026 salary	paid	2026-04-17 09:06:57.839	2026-04-17 09:06:57.839765
29	3	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-17 09:13:56.944	2026-04-17 09:13:56.945192
30	2	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-17 09:13:57.92	2026-04-17 09:13:57.920357
31	5	3333.33	salary	bank	4	2026	April 2026 salary	paid	2026-04-18 07:48:23.307	2026-04-18 07:48:23.308806
32	4	1600.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-18 07:48:24.357	2026-04-18 07:48:24.357949
33	5	0.00	salary	bank	4	2026	April 2026 salary	paid	2026-04-18 07:48:26.412	2026-04-18 07:48:26.412606
34	7	32666.67	salary	bank	4	2026	April 2026 salary	paid	2026-04-18 07:48:28.133	2026-04-18 07:48:28.133854
35	3	5333.34	salary	bank	4	2026	April 2026 salary	paid	2026-04-18 07:48:34.477	2026-04-18 07:48:34.478446
36	2	3666.67	salary	bank	4	2026	April 2026 salary	paid	2026-04-18 07:48:37.204	2026-04-18 07:48:37.204804
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, title, description, employee_id, status, priority, due_date, proof_url, created_at) FROM stdin;
1	Complete Q1 performance review	Review all team members Q1 performance	3	pending	high	2026-04-30	\N	2026-04-16 03:04:08.493755
2	Fix login page bug on mobile	Login page throws 500 error on iOS Safari	1	pending	high	2026-04-18	\N	2026-04-16 03:04:08.498648
3	Design new dashboard mockup	Create mockup for the new analytics dashboard	2	pending	medium	2026-04-25	\N	2026-04-16 03:04:08.50319
4	Update employee handbook	\N	5	pending	low	2026-05-01	\N	2026-04-16 03:04:08.507507
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, role, company_name, created_at) FROM stdin;
1	Rahul Sharma	admin@staffflow.com	$2b$10$iMjQZIEepELKkQEPQnZjlOSbs64BSPxXkGXv9jg9jrtkX1WD0Pbqy	admin	TechCo Solutions Pvt Ltd	2026-04-16 03:04:08.155297
2	Harsh Allegient	harsh.allegient@gmail.com	$2b$10$PTaRJ5pHQsVwiCgbHDt8TuD52v3Jgnmt.nchKkaS9.PPfKdJHLlt.	admin	Allegient	2026-04-17 09:07:38.981337
3	Jah	jHahaha@gmail.com	$2b$10$IdzGjsX9Jr3QF1/SBS8FG.iMFLCDBOit1UCW5iQNAbrflx2LXCcga	admin	Jejs	2026-04-23 15:49:24.60245
\.


--
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_id_seq', 83, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employees_id_seq', 7, true);


--
-- Name: leave_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leave_balances_id_seq', 7, true);


--
-- Name: leaves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leaves_id_seq', 1, false);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payments_id_seq', 36, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 4, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_admin_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_admin_id_users_id_fk FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leave_balances leave_balances_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leaves leaves_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: payments payments_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 7dIgsZqaklitWhIe4sJABVxpgg1QMlcCqjdKAEBcaPKhg9NMysUqnRJ0UMq4cdm

