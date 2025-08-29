--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)

-- Started on 2025-08-24 23:48:43 +07

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
-- TOC entry 215 (class 1259 OID 16390)
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'user'::text
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 16396)
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admins_id_seq OWNER TO postgres;

--
-- TOC entry 3459 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 217 (class 1259 OID 16397)
-- Name: food_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.food_options (
    option_id integer NOT NULL,
    food_id integer NOT NULL,
    label text NOT NULL,
    extra_price numeric(10,2) DEFAULT 0
);


ALTER TABLE public.food_options OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16403)
-- Name: food_options_option_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.food_options_option_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.food_options_option_id_seq OWNER TO postgres;

--
-- TOC entry 3460 (class 0 OID 0)
-- Dependencies: 218
-- Name: food_options_option_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.food_options_option_id_seq OWNED BY public.food_options.option_id;


--
-- TOC entry 219 (class 1259 OID 16404)
-- Name: foods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.foods (
    food_id integer NOT NULL,
    market_id integer NOT NULL,
    food_name text NOT NULL,
    price numeric(10,2) NOT NULL,
    image_url text,
    created_at timestamp without time zone DEFAULT now(),
    options jsonb DEFAULT '[]'::jsonb,
    rating numeric(2,1)
);


ALTER TABLE public.foods OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16411)
-- Name: foods_food_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.foods_food_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.foods_food_id_seq OWNER TO postgres;

--
-- TOC entry 3461 (class 0 OID 0)
-- Dependencies: 220
-- Name: foods_food_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.foods_food_id_seq OWNED BY public.foods.food_id;


--
-- TOC entry 221 (class 1259 OID 16412)
-- Name: markets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.markets (
    market_id integer NOT NULL,
    owner_id integer,
    shop_name text NOT NULL,
    shop_description text,
    shop_logo_url text,
    created_at timestamp without time zone DEFAULT now(),
    latitude double precision,
    longitude double precision,
    open_time text,
    close_time text,
    is_open boolean DEFAULT false,
    is_manual_override boolean DEFAULT false,
    override_until timestamp with time zone,
    rating numeric(2,1)
);


ALTER TABLE public.markets OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16420)
-- Name: markets_market_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.markets_market_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.markets_market_id_seq OWNER TO postgres;

--
-- TOC entry 3462 (class 0 OID 0)
-- Dependencies: 222
-- Name: markets_market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.markets_market_id_seq OWNED BY public.markets.market_id;


--
-- TOC entry 223 (class 1259 OID 16421)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    google_id text,
    display_name text,
    email text NOT NULL,
    password text,
    birthdate date,
    gender integer,
    phone text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_verified boolean DEFAULT false,
    photo_url text,
    providers text,
    is_seller boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16429)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- TOC entry 3463 (class 0 OID 0)
-- Dependencies: 224
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 3269 (class 2604 OID 16430)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 3271 (class 2604 OID 16431)
-- Name: food_options option_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_options ALTER COLUMN option_id SET DEFAULT nextval('public.food_options_option_id_seq'::regclass);


--
-- TOC entry 3273 (class 2604 OID 16432)
-- Name: foods food_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods ALTER COLUMN food_id SET DEFAULT nextval('public.foods_food_id_seq'::regclass);


--
-- TOC entry 3276 (class 2604 OID 16433)
-- Name: markets market_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets ALTER COLUMN market_id SET DEFAULT nextval('public.markets_market_id_seq'::regclass);


--
-- TOC entry 3280 (class 2604 OID 16434)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 3444 (class 0 OID 16390)
-- Dependencies: 215
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admins (id, username, password, role) FROM stdin;
1	M_ADMIN	$2b$10$DcqigpmUwgCk5LozimgKT.PbhcNwfLqYJeaeIDnH1Be6zhZeeh7fS	m_admin
6	ADMIN3	$2b$10$uuGLbfeLB7vkuPnG0/MzfuvXWl9cMIUOrDItQJS9fc0TgrT3E7GlK	user
8	ADMIN_H	$2b$10$xQ.DeJ7wwqP71A1zcIlOkO7wnRmirrymrk8R6lKdYAtIQh2qCLeba	user
13	H_ADMIN	$2b$10$SZ8AbWTpLBG4.tFXrizBBuECMiEpb7QCjP18slH6NrdFQVLLkzY/i	m_admin
4	ADMIN1	$2b$10$tsziOAy2pKtbP4Avi9fT5ert6U0DBWyVFPO7Uzg/gRljjtpBPEEyy	admin
5	ADMIN2	$2b$10$VgIPiz20GX8u4H7RoUeMAO16051AA.aTgsrlIk7GFBd9QtC4P8SFG	user
14	ADMIN4	$2b$10$EQNCltU5vtj4LwwWEqGluObDC3sloblkmqcuWqDbkMtgrP5Mob7QO	user
\.


--
-- TOC entry 3446 (class 0 OID 16397)
-- Dependencies: 217
-- Data for Name: food_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.food_options (option_id, food_id, label, extra_price) FROM stdin;
\.


--
-- TOC entry 3448 (class 0 OID 16404)
-- Dependencies: 219
-- Data for Name: foods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.foods (food_id, market_id, food_name, price, image_url, created_at, options, rating) FROM stdin;
8	31	ข้าว222	1130.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1755541643/Market-LOGO/je7jvqj3j1tmv9kqwge8.jpg	2025-08-19 01:27:27.900771	[]	\N
9	31	d cow	12.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1755542885/Market-LOGO/qyfr69ombdvpgnusk6yk.jpg	2025-08-19 01:48:09.49878	[]	\N
10	31	a	1234.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1755543072/Market-LOGO/x1f1ue6amlfjacgjqfmh.jpg	2025-08-19 01:51:16.898616	[{"label": "a", "extraPrice": 10}, {"label": "b", "extraPrice": 20}]	\N
12	32	Buger	210.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1755551770/Market-LOGO/jrjygz449thjkdz8tltc.jpg	2025-08-19 04:16:09.657469	[{"label": "Mayo", "extraPrice": 10}, {"label": "Kitchup", "extraPrice": 20}, {"label": "Meat", "extraPrice": 50}]	\N
\.


--
-- TOC entry 3450 (class 0 OID 16412)
-- Dependencies: 221
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.markets (market_id, owner_id, shop_name, shop_description, shop_logo_url, created_at, latitude, longitude, open_time, close_time, is_open, is_manual_override, override_until, rating) FROM stdin;
31	21	Burger Street	ขายเบอร์เกอร์ที่อร่อยๆ มีให้เลือกมากมาย	https://res.cloudinary.com/djqdn2zru/image/upload/v1754250121/Market-LOGO/bsuaw6bjfyq5smej8hqm.jpg	2025-08-04 02:42:00.888232	17.2916162	104.1129242	05:50	20:40	f	f	\N	\N
32	22	12 Burg	sell food	https://res.cloudinary.com/djqdn2zru/image/upload/v1755551672/Market-LOGO/liewi5quylceuazuy67o.jpg	2025-08-19 04:14:31.607904	17.169805653617185	104.14964765310287	03:12	23:18	f	f	\N	\N
\.


--
-- TOC entry 3452 (class 0 OID 16421)
-- Dependencies: 223
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, google_id, display_name, email, password, birthdate, gender, phone, created_at, is_verified, photo_url, providers, is_seller) FROM stdin;
21	105392817902249087793	Taweechok KH.	taweechok.k@ku.th	\N	2003-07-05	0	0989520103	2025-08-03 23:35:28.445882	t	https://lh3.googleusercontent.com/a/ACg8ocLgf2QVH2faiqfFPK_Xm49JegXu7hTVP6EjlEZUj4a0Oy6KCF6W=s96-c	google	t
22	101628051506191273987	Taweechok Khamphusa	aumt1569@gmail.com	\N	2000-01-03	1	0989520103	2025-08-19 04:10:45.285982	t	https://lh3.googleusercontent.com/a/ACg8ocJw8scPixF2PrzJUUzpznN9BOXF94U_ylti8av5jpEvQ9CN4g=s96-c	google	t
\.


--
-- TOC entry 3464 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 14, true);


--
-- TOC entry 3465 (class 0 OID 0)
-- Dependencies: 218
-- Name: food_options_option_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.food_options_option_id_seq', 1, false);


--
-- TOC entry 3466 (class 0 OID 0)
-- Dependencies: 220
-- Name: foods_food_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.foods_food_id_seq', 7, true);


--
-- TOC entry 3467 (class 0 OID 0)
-- Dependencies: 222
-- Name: markets_market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.markets_market_id_seq', 31, true);


--
-- TOC entry 3468 (class 0 OID 0)
-- Dependencies: 224
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 21, true);


--
-- TOC entry 3285 (class 2606 OID 16436)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 3287 (class 2606 OID 16438)
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- TOC entry 3289 (class 2606 OID 16440)
-- Name: food_options food_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_options
    ADD CONSTRAINT food_options_pkey PRIMARY KEY (option_id);


--
-- TOC entry 3291 (class 2606 OID 16442)
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (food_id);


--
-- TOC entry 3293 (class 2606 OID 16444)
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (market_id);


--
-- TOC entry 3295 (class 2606 OID 16446)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3297 (class 2606 OID 16448)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3298 (class 2606 OID 16449)
-- Name: food_options food_options_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_options
    ADD CONSTRAINT food_options_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 3299 (class 2606 OID 16454)
-- Name: foods foods_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3300 (class 2606 OID 16459)
-- Name: markets markets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


-- Completed on 2025-08-24 23:48:43 +07

--
-- PostgreSQL database dump complete
--

