--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)

-- Started on 2025-09-13 13:53:51 +07

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

--
-- TOC entry 231 (class 1255 OID 16527)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 16528)
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
-- TOC entry 216 (class 1259 OID 16534)
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
-- TOC entry 3529 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 230 (class 1259 OID 16693)
-- Name: carts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carts (
    cart_id integer NOT NULL,
    user_id integer NOT NULL,
    food_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    selected_options jsonb,
    note text,
    total numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.carts OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 16692)
-- Name: carts_cart_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carts_cart_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carts_cart_id_seq OWNER TO postgres;

--
-- TOC entry 3530 (class 0 OID 0)
-- Dependencies: 229
-- Name: carts_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carts_cart_id_seq OWNED BY public.carts.cart_id;


--
-- TOC entry 217 (class 1259 OID 16535)
-- Name: categorys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorys (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.categorys OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16538)
-- Name: categorys_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorys_id_seq OWNER TO postgres;

--
-- TOC entry 3531 (class 0 OID 0)
-- Dependencies: 218
-- Name: categorys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorys_id_seq OWNED BY public.categorys.id;


--
-- TOC entry 219 (class 1259 OID 16546)
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
    rating numeric(2,1),
    sell_price numeric(10,2)
);


ALTER TABLE public.foods OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16553)
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
-- TOC entry 3532 (class 0 OID 0)
-- Dependencies: 220
-- Name: foods_food_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.foods_food_id_seq OWNED BY public.foods.food_id;


--
-- TOC entry 221 (class 1259 OID 16554)
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
    rating numeric(2,1),
    address text,
    phone text,
    approve boolean DEFAULT false,
    admin_id integer,
    is_admin boolean DEFAULT false
);


ALTER TABLE public.markets OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16564)
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
-- TOC entry 3533 (class 0 OID 0)
-- Dependencies: 222
-- Name: markets_market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.markets_market_id_seq OWNED BY public.markets.market_id;


--
-- TOC entry 223 (class 1259 OID 16565)
-- Name: rider_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rider_addresses (
    address_id integer NOT NULL,
    user_id integer NOT NULL,
    house_number text,
    street text,
    subdistrict text NOT NULL,
    district text NOT NULL,
    province text NOT NULL,
    postal_code text,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rider_addresses OWNER TO postgres;

--
-- TOC entry 3534 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE rider_addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_addresses IS 'ตารางเก็บที่อยู่ของไรเดอร์';


--
-- TOC entry 3535 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN rider_addresses.subdistrict; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.subdistrict IS 'ตำบล';


--
-- TOC entry 3536 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN rider_addresses.district; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.district IS 'อำเภอ';


--
-- TOC entry 3537 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN rider_addresses.province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.province IS 'จังหวัด';


--
-- TOC entry 224 (class 1259 OID 16573)
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rider_addresses_address_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rider_addresses_address_id_seq OWNER TO postgres;

--
-- TOC entry 3538 (class 0 OID 0)
-- Dependencies: 224
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_addresses_address_id_seq OWNED BY public.rider_addresses.address_id;


--
-- TOC entry 225 (class 1259 OID 16574)
-- Name: rider_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rider_profiles (
    rider_id integer NOT NULL,
    user_id integer NOT NULL,
    id_card_number text NOT NULL,
    id_card_photo_url text NOT NULL,
    id_card_selfie_url text NOT NULL,
    driving_license_number text NOT NULL,
    driving_license_photo_url text NOT NULL,
    vehicle_type text DEFAULT 'motorcycle'::text NOT NULL,
    vehicle_brand_model text NOT NULL,
    vehicle_color text NOT NULL,
    vehicle_photo_url text NOT NULL,
    vehicle_registration_photo_url text NOT NULL,
    approval_status text DEFAULT 'pending'::text,
    approved_by integer,
    approved_at timestamp without time zone,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    vehicle_registration_number text DEFAULT ''::text NOT NULL,
    vehicle_registration_province text DEFAULT ''::text NOT NULL,
    CONSTRAINT chk_approval_status CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chk_vehicle_type CHECK ((vehicle_type = 'motorcycle'::text))
);


ALTER TABLE public.rider_profiles OWNER TO postgres;

--
-- TOC entry 3539 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE rider_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_profiles IS 'ตารางเก็บข้อมูลไรเดอร์ที่ต้องการยืนยันตัวตน';


--
-- TOC entry 3540 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.id_card_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_photo_url IS 'รูปถ่ายบัตรประชาชน';


--
-- TOC entry 3541 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.id_card_selfie_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_selfie_url IS 'รูปถ่ายคู่บัตรประชาชน';


--
-- TOC entry 3542 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.driving_license_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.driving_license_photo_url IS 'รูปใบขับขี่';


--
-- TOC entry 3543 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.vehicle_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_type IS 'ประเภทรถ (ปัจจุบันรองรับแค่ motorcycle)';


--
-- TOC entry 3544 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.vehicle_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_photo_url IS 'รูปถ่ายรถ';


--
-- TOC entry 3545 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.vehicle_registration_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_photo_url IS 'รูปคู่มือทะเบียนรถ';


--
-- TOC entry 3546 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.vehicle_registration_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';


--
-- TOC entry 3547 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN rider_profiles.vehicle_registration_province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';


--
-- TOC entry 226 (class 1259 OID 16587)
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rider_profiles_rider_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rider_profiles_rider_id_seq OWNER TO postgres;

--
-- TOC entry 3548 (class 0 OID 0)
-- Dependencies: 226
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_profiles_rider_id_seq OWNED BY public.rider_profiles.rider_id;


--
-- TOC entry 227 (class 1259 OID 16588)
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
    is_seller boolean DEFAULT false,
    role text DEFAULT 'member'::text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16597)
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
-- TOC entry 3549 (class 0 OID 0)
-- Dependencies: 228
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 3285 (class 2604 OID 16598)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 3313 (class 2604 OID 16696)
-- Name: carts cart_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts ALTER COLUMN cart_id SET DEFAULT nextval('public.carts_cart_id_seq'::regclass);


--
-- TOC entry 3287 (class 2604 OID 16599)
-- Name: categorys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys ALTER COLUMN id SET DEFAULT nextval('public.categorys_id_seq'::regclass);


--
-- TOC entry 3288 (class 2604 OID 16601)
-- Name: foods food_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods ALTER COLUMN food_id SET DEFAULT nextval('public.foods_food_id_seq'::regclass);


--
-- TOC entry 3291 (class 2604 OID 16602)
-- Name: markets market_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets ALTER COLUMN market_id SET DEFAULT nextval('public.markets_market_id_seq'::regclass);


--
-- TOC entry 3297 (class 2604 OID 16603)
-- Name: rider_addresses address_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses ALTER COLUMN address_id SET DEFAULT nextval('public.rider_addresses_address_id_seq'::regclass);


--
-- TOC entry 3301 (class 2604 OID 16604)
-- Name: rider_profiles rider_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles ALTER COLUMN rider_id SET DEFAULT nextval('public.rider_profiles_rider_id_seq'::regclass);


--
-- TOC entry 3308 (class 2604 OID 16605)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 3508 (class 0 OID 16528)
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
-- TOC entry 3523 (class 0 OID 16693)
-- Dependencies: 230
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carts (cart_id, user_id, food_id, quantity, selected_options, note, total, created_at) FROM stdin;
25	31	20	1	[]		35	2025-09-12 12:20:12.162249
26	31	18	5	[{"label": "ไก่", "extraPrice": 10}]		180	2025-09-12 12:21:04.462235
27	31	19	2	[]		134	2025-09-12 13:19:45.275549
\.


--
-- TOC entry 3510 (class 0 OID 16535)
-- Dependencies: 217
-- Data for Name: categorys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorys (id, name) FROM stdin;
\.


--
-- TOC entry 3512 (class 0 OID 16546)
-- Dependencies: 219
-- Data for Name: foods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.foods (food_id, market_id, food_name, price, image_url, created_at, options, rating, sell_price) FROM stdin;
18	37	ลาบะ	23.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614820/Market-LOGO/uxxu9ksyzmbjvejbiba6.jpg	2025-09-12 01:20:20.96686	[{"label": "ไก่", "extraPrice": 10}, {"label": "หมู", "extraPrice": 15}, {"label": "เนื้อ", "extraPrice": 20}, {"label": "เป็ด", "extraPrice": 40}]	\N	26.00
19	38	อ่อมหมู	59.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614871/Market-LOGO/ph5jwppwayvgmih9ohpc.jpg	2025-09-12 01:21:12.136991	[]	\N	67.00
20	37	ลข	31.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757654055/Market-LOGO/hwe1fcjovtxmkuyjh17n.jpg	2025-09-12 12:14:16.611986	[]	3.0	35.00
\.


--
-- TOC entry 3514 (class 0 OID 16554)
-- Dependencies: 221
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.markets (market_id, owner_id, shop_name, shop_description, shop_logo_url, created_at, latitude, longitude, open_time, close_time, is_open, is_manual_override, override_until, rating, address, phone, approve, admin_id, is_admin) FROM stdin;
37	31	เสกสายเบิร์น (ย่าง)	ขายไก่ย่าง เนื้อย่าง ปลาเผา ส่งฟรี ส่งไว หอมอร่อย. 🏎️💥	https://res.cloudinary.com/djqdn2zru/image/upload/v1757491128/Market-LOGO/zegkbequ9px72yz8mdkn.jpg	2025-09-10 14:58:49.472311	17.27025890434053	104.13420014083385	14:00	20:30	f	f	\N	\N	42/6 เชียงเครือ หออะตอม 45801	0987654321	t	\N	f
38	\N	ร้านแอดมิน	ร้านแอดมิน เด้อจ่ะ แพงขึ้น 20%	https://res.cloudinary.com/djqdn2zru/image/upload/v1757608039/food-menu/hserelfmmpvtup06j3lb.jpg	2025-09-11 23:27:20.249612	13.736717	100.523186	\N	\N	f	f	\N	\N	23/1 เชียงเครือ	-	f	1	t
\.


--
-- TOC entry 3516 (class 0 OID 16565)
-- Dependencies: 223
-- Data for Name: rider_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_addresses (address_id, user_id, house_number, street, subdistrict, district, province, postal_code, is_default, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3518 (class 0 OID 16574)
-- Dependencies: 225
-- Data for Name: rider_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_profiles (rider_id, user_id, id_card_number, id_card_photo_url, id_card_selfie_url, driving_license_number, driving_license_photo_url, vehicle_type, vehicle_brand_model, vehicle_color, vehicle_photo_url, vehicle_registration_photo_url, approval_status, approved_by, approved_at, rejection_reason, created_at, updated_at, vehicle_registration_number, vehicle_registration_province) FROM stdin;
\.


--
-- TOC entry 3520 (class 0 OID 16588)
-- Dependencies: 227
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, google_id, display_name, email, password, birthdate, gender, phone, created_at, is_verified, photo_url, providers, is_seller, role) FROM stdin;
31	105392817902249087793	Taweechok KHAMPHUSA	taweechok.k@ku.th	\N	2003-07-06	0	0989520103	2025-09-10 14:42:48.63126	t	https://lh3.googleusercontent.com/a/ACg8ocLgf2QVH2faiqfFPK_Xm49JegXu7hTVP6EjlEZUj4a0Oy6KCF6W=s96-c	google	t	member
32	101628051506191273987	Taweechok Khamphusa	aumt1569@gmail.com	\N	\N	\N	\N	2025-09-10 20:09:47.358897	f	https://lh3.googleusercontent.com/a/ACg8ocJw8scPixF2PrzJUUzpznN9BOXF94U_ylti8av5jpEvQ9CN4g=s96-c	google	f	member
\.


--
-- TOC entry 3550 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 14, true);


--
-- TOC entry 3551 (class 0 OID 0)
-- Dependencies: 229
-- Name: carts_cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carts_cart_id_seq', 27, true);


--
-- TOC entry 3552 (class 0 OID 0)
-- Dependencies: 218
-- Name: categorys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorys_id_seq', 1, false);


--
-- TOC entry 3553 (class 0 OID 0)
-- Dependencies: 220
-- Name: foods_food_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.foods_food_id_seq', 20, true);


--
-- TOC entry 3554 (class 0 OID 0)
-- Dependencies: 222
-- Name: markets_market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.markets_market_id_seq', 38, true);


--
-- TOC entry 3555 (class 0 OID 0)
-- Dependencies: 224
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_addresses_address_id_seq', 5, true);


--
-- TOC entry 3556 (class 0 OID 0)
-- Dependencies: 226
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_profiles_rider_id_seq', 7, true);


--
-- TOC entry 3557 (class 0 OID 0)
-- Dependencies: 228
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 32, true);


--
-- TOC entry 3319 (class 2606 OID 16607)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 3321 (class 2606 OID 16609)
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- TOC entry 3354 (class 2606 OID 16702)
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (cart_id);


--
-- TOC entry 3323 (class 2606 OID 16611)
-- Name: categorys categorys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys
    ADD CONSTRAINT categorys_pkey PRIMARY KEY (id);


--
-- TOC entry 3325 (class 2606 OID 16615)
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (food_id);


--
-- TOC entry 3327 (class 2606 OID 16617)
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (market_id);


--
-- TOC entry 3332 (class 2606 OID 16619)
-- Name: rider_addresses rider_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT rider_addresses_pkey PRIMARY KEY (address_id);


--
-- TOC entry 3340 (class 2606 OID 16621)
-- Name: rider_profiles rider_profiles_driving_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_driving_license_number_key UNIQUE (driving_license_number);


--
-- TOC entry 3342 (class 2606 OID 16623)
-- Name: rider_profiles rider_profiles_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_id_card_number_key UNIQUE (id_card_number);


--
-- TOC entry 3344 (class 2606 OID 16625)
-- Name: rider_profiles rider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_pkey PRIMARY KEY (rider_id);


--
-- TOC entry 3346 (class 2606 OID 16627)
-- Name: rider_profiles rider_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 3348 (class 2606 OID 16629)
-- Name: rider_profiles unique_vehicle_registration; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT unique_vehicle_registration UNIQUE (vehicle_registration_number, vehicle_registration_province);


--
-- TOC entry 3350 (class 2606 OID 16631)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3352 (class 2606 OID 16633)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3328 (class 1259 OID 16634)
-- Name: idx_rider_addresses_district; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_district ON public.rider_addresses USING btree (district, province);


--
-- TOC entry 3329 (class 1259 OID 16635)
-- Name: idx_rider_addresses_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_province ON public.rider_addresses USING btree (province);


--
-- TOC entry 3330 (class 1259 OID 16636)
-- Name: idx_rider_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_user_id ON public.rider_addresses USING btree (user_id);


--
-- TOC entry 3333 (class 1259 OID 16637)
-- Name: idx_rider_profiles_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_approval_status ON public.rider_profiles USING btree (approval_status);


--
-- TOC entry 3334 (class 1259 OID 16638)
-- Name: idx_rider_profiles_driving_license_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_driving_license_number ON public.rider_profiles USING btree (driving_license_number);


--
-- TOC entry 3335 (class 1259 OID 16639)
-- Name: idx_rider_profiles_id_card_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_id_card_number ON public.rider_profiles USING btree (id_card_number);


--
-- TOC entry 3336 (class 1259 OID 16640)
-- Name: idx_rider_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_user_id ON public.rider_profiles USING btree (user_id);


--
-- TOC entry 3337 (class 1259 OID 16641)
-- Name: idx_rider_profiles_vehicle_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles USING btree (vehicle_registration_province);


--
-- TOC entry 3338 (class 1259 OID 16642)
-- Name: idx_rider_profiles_vehicle_registration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles USING btree (vehicle_registration_number);


--
-- TOC entry 3363 (class 2620 OID 16643)
-- Name: rider_addresses update_rider_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_addresses_updated_at BEFORE UPDATE ON public.rider_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3364 (class 2620 OID 16644)
-- Name: rider_profiles update_rider_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3361 (class 2606 OID 16708)
-- Name: carts carts_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 3362 (class 2606 OID 16703)
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3356 (class 2606 OID 16645)
-- Name: markets fk_admin; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 3358 (class 2606 OID 16650)
-- Name: rider_addresses fk_rider_addresses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT fk_rider_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3359 (class 2606 OID 16655)
-- Name: rider_profiles fk_rider_profiles_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES public.admins(id);


--
-- TOC entry 3360 (class 2606 OID 16660)
-- Name: rider_profiles fk_rider_profiles_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3355 (class 2606 OID 16670)
-- Name: foods foods_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3357 (class 2606 OID 16675)
-- Name: markets markets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


-- Completed on 2025-09-13 13:53:52 +07

--
-- PostgreSQL database dump complete
--

