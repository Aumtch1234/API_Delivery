--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-09-13 17:11:10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 233 (class 1255 OID 16747)
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
-- TOC entry 217 (class 1259 OID 16616)
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
-- TOC entry 218 (class 1259 OID 16622)
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
-- TOC entry 5023 (class 0 OID 0)
-- Dependencies: 218
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 232 (class 1259 OID 16757)
-- Name: categorys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorys (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.categorys OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 16756)
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
-- TOC entry 5024 (class 0 OID 0)
-- Dependencies: 231
-- Name: categorys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorys_id_seq OWNED BY public.categorys.id;


--
-- TOC entry 219 (class 1259 OID 16623)
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
-- TOC entry 220 (class 1259 OID 16629)
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
-- TOC entry 5025 (class 0 OID 0)
-- Dependencies: 220
-- Name: food_options_option_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.food_options_option_id_seq OWNED BY public.food_options.option_id;


--
-- TOC entry 221 (class 1259 OID 16630)
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
-- TOC entry 222 (class 1259 OID 16637)
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
-- TOC entry 5026 (class 0 OID 0)
-- Dependencies: 222
-- Name: foods_food_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.foods_food_id_seq OWNED BY public.foods.food_id;


--
-- TOC entry 223 (class 1259 OID 16638)
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
-- TOC entry 224 (class 1259 OID 16647)
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
-- TOC entry 5027 (class 0 OID 0)
-- Dependencies: 224
-- Name: markets_market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.markets_market_id_seq OWNED BY public.markets.market_id;


--
-- TOC entry 228 (class 1259 OID 16693)
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
-- TOC entry 5028 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE rider_addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_addresses IS 'ตารางเก็บที่อยู่ของไรเดอร์';


--
-- TOC entry 5029 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN rider_addresses.subdistrict; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.subdistrict IS 'ตำบล';


--
-- TOC entry 5030 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN rider_addresses.district; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.district IS 'อำเภอ';


--
-- TOC entry 5031 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN rider_addresses.province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.province IS 'จังหวัด';


--
-- TOC entry 227 (class 1259 OID 16692)
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
-- TOC entry 5032 (class 0 OID 0)
-- Dependencies: 227
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_addresses_address_id_seq OWNED BY public.rider_addresses.address_id;


--
-- TOC entry 230 (class 1259 OID 16710)
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
    promptpay character varying(20),
    CONSTRAINT chk_approval_status CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chk_vehicle_type CHECK ((vehicle_type = 'motorcycle'::text))
);


ALTER TABLE public.rider_profiles OWNER TO postgres;

--
-- TOC entry 5033 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE rider_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_profiles IS 'ตารางเก็บข้อมูลไรเดอร์ที่ต้องการยืนยันตัวตน';


--
-- TOC entry 5034 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.id_card_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_photo_url IS 'รูปถ่ายบัตรประชาชน';


--
-- TOC entry 5035 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.id_card_selfie_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_selfie_url IS 'รูปถ่ายคู่บัตรประชาชน';


--
-- TOC entry 5036 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.driving_license_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.driving_license_photo_url IS 'รูปใบขับขี่';


--
-- TOC entry 5037 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.vehicle_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_type IS 'ประเภทรถ (ปัจจุบันรองรับแค่ motorcycle)';


--
-- TOC entry 5038 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.vehicle_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_photo_url IS 'รูปถ่ายรถ';


--
-- TOC entry 5039 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.vehicle_registration_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_photo_url IS 'รูปคู่มือทะเบียนรถ';


--
-- TOC entry 5040 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.vehicle_registration_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';


--
-- TOC entry 5041 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.vehicle_registration_province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';


--
-- TOC entry 5042 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rider_profiles.promptpay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.promptpay IS 'หมายเลข PromptPay (เบอร์โทร 10 หลักหรือเลขบัตรประชาชน 13 หลัก)';


--
-- TOC entry 229 (class 1259 OID 16709)
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
-- TOC entry 5043 (class 0 OID 0)
-- Dependencies: 229
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_profiles_rider_id_seq OWNED BY public.rider_profiles.rider_id;


--
-- TOC entry 225 (class 1259 OID 16648)
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
-- TOC entry 226 (class 1259 OID 16656)
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
-- TOC entry 5044 (class 0 OID 0)
-- Dependencies: 226
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 4778 (class 2604 OID 16657)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 4807 (class 2604 OID 16760)
-- Name: categorys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys ALTER COLUMN id SET DEFAULT nextval('public.categorys_id_seq'::regclass);


--
-- TOC entry 4780 (class 2604 OID 16658)
-- Name: food_options option_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_options ALTER COLUMN option_id SET DEFAULT nextval('public.food_options_option_id_seq'::regclass);


--
-- TOC entry 4782 (class 2604 OID 16659)
-- Name: foods food_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods ALTER COLUMN food_id SET DEFAULT nextval('public.foods_food_id_seq'::regclass);


--
-- TOC entry 4785 (class 2604 OID 16660)
-- Name: markets market_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets ALTER COLUMN market_id SET DEFAULT nextval('public.markets_market_id_seq'::regclass);


--
-- TOC entry 4796 (class 2604 OID 16696)
-- Name: rider_addresses address_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses ALTER COLUMN address_id SET DEFAULT nextval('public.rider_addresses_address_id_seq'::regclass);


--
-- TOC entry 4800 (class 2604 OID 16713)
-- Name: rider_profiles rider_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles ALTER COLUMN rider_id SET DEFAULT nextval('public.rider_profiles_rider_id_seq'::regclass);


--
-- TOC entry 4791 (class 2604 OID 16661)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 5002 (class 0 OID 16616)
-- Dependencies: 217
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
-- TOC entry 5017 (class 0 OID 16757)
-- Dependencies: 232
-- Data for Name: categorys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorys (id, name) FROM stdin;
1	aad
2	a
3	z
\.


--
-- TOC entry 5004 (class 0 OID 16623)
-- Dependencies: 219
-- Data for Name: food_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.food_options (option_id, food_id, label, extra_price) FROM stdin;
\.


--
-- TOC entry 5006 (class 0 OID 16630)
-- Dependencies: 221
-- Data for Name: foods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.foods (food_id, market_id, food_name, price, image_url, created_at, options, rating) FROM stdin;
8	32	Burger Full Set	159.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1756069572/Market-LOGO/ewxjmt8rwn0ccjvsi0hy.jpg	2025-08-25 04:06:13.402229	[{"label": "Kitchup", "extraPrice": 5}, {"label": "Mastard", "extraPrice": 20}]	\N
9	33	Kaprao	1000.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1756286362/Market-LOGO/ffi3ws9zp1rfsqdxew2c.jpg	2025-08-27 16:19:23.176928	[{"label": "Meat", "extraPrice": 10}, {"label": "Pork", "extraPrice": 20000}]	\N
\.


--
-- TOC entry 5008 (class 0 OID 16638)
-- Dependencies: 223
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.markets (market_id, owner_id, shop_name, shop_description, shop_logo_url, created_at, latitude, longitude, open_time, close_time, is_open, is_manual_override, override_until, rating, address, phone, approve, admin_id, is_admin) FROM stdin;
32	22	Burger 25hr.	Sell Fish Beef Meat Pork Steck Chim Chicken Burger all day 25 hr.	https://res.cloudinary.com/djqdn2zru/image/upload/v1756062639/Market-LOGO/wy8sf1qrwdpsnvq2bml4.jpg	2025-08-25 02:10:40.196895	16.950672627881698	104.48594704270363	02:00	01:50	t	f	\N	\N	25/10 Nakae Nakhonphanom 48130	0989520103	t	\N	f
33	23	Pasin	Sell Food	https://res.cloudinary.com/djqdn2zru/image/upload/v1756286248/Market-LOGO/sltczixehdepqgbq7e63.jpg	2025-08-27 16:17:29.725681	13.849895288940463	100.57221047580242	15:16	23:20	t	f	\N	\N	Sakon	099999999	t	\N	f
\.


--
-- TOC entry 5013 (class 0 OID 16693)
-- Dependencies: 228
-- Data for Name: rider_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_addresses (address_id, user_id, house_number, street, subdistrict, district, province, postal_code, is_default, created_at, updated_at) FROM stdin;
1	26	a	\N	a	a	a	\N	t	2025-09-02 17:51:00.274911	2025-09-02 17:51:00.274911
5	30	388	\N	เชียงเครือ	เมือง	สกล	\N	t	2025-09-09 00:46:10.474683	2025-09-09 00:46:10.474683
6	48	202	\N	ดอนหัวฬ่อ	เมืองชลบุรี	ชลบุรี	\N	t	2025-09-13 14:40:35.001951	2025-09-13 14:40:35.001951
\.


--
-- TOC entry 5015 (class 0 OID 16710)
-- Dependencies: 230
-- Data for Name: rider_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_profiles (rider_id, user_id, id_card_number, id_card_photo_url, id_card_selfie_url, driving_license_number, driving_license_photo_url, vehicle_type, vehicle_brand_model, vehicle_color, vehicle_photo_url, vehicle_registration_photo_url, approval_status, approved_by, approved_at, rejection_reason, created_at, updated_at, vehicle_registration_number, vehicle_registration_province, promptpay) FROM stdin;
1	26	1101700123456	https://res.cloudinary.com/djqdn2zru/image/upload/v1756895196/rider-documents/t4sjbi6shmdzqpt3ru4d.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1756895192/rider-documents/pc4cpwqtbzdb91fcmdhl.png	DL1234567	https://res.cloudinary.com/djqdn2zru/image/upload/v1756895199/rider-documents/isnkcjt3zzyjdqb4gtwy.png	motorcycle	Honda Wave	Red	https://res.cloudinary.com/djqdn2zru/image/upload/v1756895203/rider-documents/g83egcjphuq2purqoowh.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1756895206/rider-documents/juk8pie7wofchtkaxigy.png	pending	\N	\N	\N	2025-09-03 17:26:20.32327	2025-09-13 11:14:38.098631			\N
7	30	9901700123459	https://res.cloudinary.com/djqdn2zru/image/upload/v1757733085/rider-documents/v4igd7wx9wusmsuv7ci4.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1757733084/rider-documents/t9pl6unluaw96road7ge.png	DL1234568	https://res.cloudinary.com/djqdn2zru/image/upload/v1757733087/rider-documents/rk14eiwdzj6a2xi9fqkf.png	motorcycle	Honda Wave	Red	https://res.cloudinary.com/djqdn2zru/image/upload/v1757733088/rider-documents/rxjarvh9u8d3viaotelz.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1757733089/rider-documents/kxaqu3bhbezcglovl0an.jpg	rejected	1	2025-09-13 11:16:56.74126	ควาย...เอกสารไม่ครบ	2025-09-09 00:46:34.966598	2025-09-13 11:16:56.74126	ฟก-123	สกลนคร	\N
12	48	1234567891230	https://res.cloudinary.com/djqdn2zru/image/upload/v1757751248/rider-documents/mhxwdmgqfbfhbtclvgmu.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1757751247/rider-documents/ke8k0ggspkzdiop7i2kx.jpg	12345678	https://res.cloudinary.com/djqdn2zru/image/upload/v1757751250/rider-documents/be6jmanp9lkvh6thqghb.jpg	motorcycle	TOYOTO	brack	https://res.cloudinary.com/djqdn2zru/image/upload/v1757751251/rider-documents/veyb760e9hz9gnl301vl.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1757751253/rider-documents/m6oxezhmuecschv2i4vd.jpg	pending	\N	\N	\N	2025-09-13 15:14:06.080696	2025-09-13 15:14:06.080696	as12	denmarg	\N
11	47	1234678913484	https://res.cloudinary.com/djqdn2zru/image/upload/v1757745928/rider-documents/m6rl8dur6pdfpkidennw.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1757745926/rider-documents/lbzxq3boidzmokgsiiqu.jpg	13465789	https://res.cloudinary.com/djqdn2zru/image/upload/v1757745929/rider-documents/dfwoguasvorkknngrvlb.jpg	motorcycle	Honda Wave	Red	https://res.cloudinary.com/djqdn2zru/image/upload/v1757745931/rider-documents/s2fve8g8qbo5thgk3owl.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1757745933/rider-documents/mzrxmz9fmulnawcjw7be.jpg	approved	1	2025-09-13 15:48:24.304955	\N	2025-09-13 11:00:16.266092	2025-09-13 16:30:59.374031	กธ12	สกล	\N
\.


--
-- TOC entry 5010 (class 0 OID 16648)
-- Dependencies: 225
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, google_id, display_name, email, password, birthdate, gender, phone, created_at, is_verified, photo_url, providers, is_seller, role) FROM stdin;
22	105392817902249087793	Taweechok KHAMPHUSA	taweechok.k@ku.th	\N	2003-07-06	0	0989520103	2025-08-25 01:28:32.89199	t	https://lh3.googleusercontent.com/a/ACg8ocLgf2QVH2faiqfFPK_Xm49JegXu7hTVP6EjlEZUj4a0Oy6KCF6W=s96-c	google	t	member
24	105426277786935562046	taweechok khamphusa	aumtch0@gmail.com	\N	2000-01-18	2	09999999	2025-08-27 16:26:26.101343	t	https://lh3.googleusercontent.com/a/ACg8ocLhitygVoLkOorCQb1eXQKeMRnO8QEYPqHRgBdySs_Rl8_EBA=s96-c	google	f	member
23	101628051506191273987	Taweechok Khamphusa	aumt1569@gmail.com	\N	2000-01-04	2	0989520103	2025-08-27 04:13:43.553736	t	https://lh3.googleusercontent.com/a/ACg8ocJw8scPixF2PrzJUUzpznN9BOXF94U_ylti8av5jpEvQ9CN4g=s96-c	google	t	member
45	110550184475464994880	ณัฐวุฒิ สุวรรณศรี	nadvdj08@gmail.com	\N	\N	\N	\N	2025-09-12 22:36:08.381357	f	https://lh3.googleusercontent.com/a/ACg8ocJ7lnlcbSf6WiCrBCJopWIvWSjLRwoCYUUC2uRdFIKHCFcrRQ=s96-c	google	f	rider
26	\N	เย้ๆ	somchai@example.com	$2b$10$vMx95uWmZOKToq9Jm.MuleEjp41xrau3bB7rnL0E1X11fQg9/XN7i	1990-01-01	0	123456789	2025-09-02 17:51:00.274911	t	\N	\N	f	rider
30	\N	เย้ๆ123	test@example.com	$2b$10$RaM.SghFxHMgQGM7AoDrqOrYV9E40Jwyu.drxhctU.0CsF/n1JOEG	1990-01-01	0	123456789	2025-09-09 00:46:10.474683	f	https://res.cloudinary.com/djqdn2zru/image/upload/v1757353571/rider-profiles/ndhbcxuthprmjgttydel.png	\N	f	rider
47	118325243465533209842	ณัฐวุฒิ สุวรรณศรี	nuttass009@gmail.com	\N	\N	\N	\N	2025-09-13 09:47:09.731037	t	https://lh3.googleusercontent.com/a/ACg8ocLfWHIvZ9WWZTZIFHtxYHNZ3WtrMGXqK2QakqUx--csINqEPQY=s96-c	google	f	rider
48	\N	Natthawut	Na@gmail.com	$2b$10$pZvQ14LUwD8sEjSvKUF9WuAgLOFrwCjSgzQS95/6gr.xAlZg7uZzm	2000-01-01	0	6549873	2025-09-13 14:40:35.001951	f	https://res.cloudinary.com/djqdn2zru/image/upload/v1757749238/rider-profiles/otoenty7xlafu1byjjk6.png	\N	f	rider
\.


--
-- TOC entry 5045 (class 0 OID 0)
-- Dependencies: 218
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 14, true);


--
-- TOC entry 5046 (class 0 OID 0)
-- Dependencies: 231
-- Name: categorys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorys_id_seq', 3, true);


--
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 220
-- Name: food_options_option_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.food_options_option_id_seq', 1, false);


--
-- TOC entry 5048 (class 0 OID 0)
-- Dependencies: 222
-- Name: foods_food_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.foods_food_id_seq', 9, true);


--
-- TOC entry 5049 (class 0 OID 0)
-- Dependencies: 224
-- Name: markets_market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.markets_market_id_seq', 35, true);


--
-- TOC entry 5050 (class 0 OID 0)
-- Dependencies: 227
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_addresses_address_id_seq', 6, true);


--
-- TOC entry 5051 (class 0 OID 0)
-- Dependencies: 229
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_profiles_rider_id_seq', 12, true);


--
-- TOC entry 5052 (class 0 OID 0)
-- Dependencies: 226
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 48, true);


--
-- TOC entry 4811 (class 2606 OID 16663)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 4813 (class 2606 OID 16665)
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- TOC entry 4847 (class 2606 OID 16762)
-- Name: categorys categorys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys
    ADD CONSTRAINT categorys_pkey PRIMARY KEY (id);


--
-- TOC entry 4815 (class 2606 OID 16667)
-- Name: food_options food_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_options
    ADD CONSTRAINT food_options_pkey PRIMARY KEY (option_id);


--
-- TOC entry 4817 (class 2606 OID 16669)
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (food_id);


--
-- TOC entry 4819 (class 2606 OID 16671)
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (market_id);


--
-- TOC entry 4828 (class 2606 OID 16703)
-- Name: rider_addresses rider_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT rider_addresses_pkey PRIMARY KEY (address_id);


--
-- TOC entry 4837 (class 2606 OID 16729)
-- Name: rider_profiles rider_profiles_driving_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_driving_license_number_key UNIQUE (driving_license_number);


--
-- TOC entry 4839 (class 2606 OID 16727)
-- Name: rider_profiles rider_profiles_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_id_card_number_key UNIQUE (id_card_number);


--
-- TOC entry 4841 (class 2606 OID 16723)
-- Name: rider_profiles rider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_pkey PRIMARY KEY (rider_id);


--
-- TOC entry 4843 (class 2606 OID 16725)
-- Name: rider_profiles rider_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 4845 (class 2606 OID 16755)
-- Name: rider_profiles unique_vehicle_registration; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT unique_vehicle_registration UNIQUE (vehicle_registration_number, vehicle_registration_province);


--
-- TOC entry 4821 (class 2606 OID 16673)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4823 (class 2606 OID 16675)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4824 (class 1259 OID 16742)
-- Name: idx_rider_addresses_district; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_district ON public.rider_addresses USING btree (district, province);


--
-- TOC entry 4825 (class 1259 OID 16741)
-- Name: idx_rider_addresses_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_province ON public.rider_addresses USING btree (province);


--
-- TOC entry 4826 (class 1259 OID 16740)
-- Name: idx_rider_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_user_id ON public.rider_addresses USING btree (user_id);


--
-- TOC entry 4829 (class 1259 OID 16744)
-- Name: idx_rider_profiles_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_approval_status ON public.rider_profiles USING btree (approval_status);


--
-- TOC entry 4830 (class 1259 OID 16746)
-- Name: idx_rider_profiles_driving_license_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_driving_license_number ON public.rider_profiles USING btree (driving_license_number);


--
-- TOC entry 4831 (class 1259 OID 16745)
-- Name: idx_rider_profiles_id_card_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_id_card_number ON public.rider_profiles USING btree (id_card_number);


--
-- TOC entry 4832 (class 1259 OID 16769)
-- Name: idx_rider_profiles_promptpay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_promptpay ON public.rider_profiles USING btree (promptpay);


--
-- TOC entry 4833 (class 1259 OID 16743)
-- Name: idx_rider_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_user_id ON public.rider_profiles USING btree (user_id);


--
-- TOC entry 4834 (class 1259 OID 16753)
-- Name: idx_rider_profiles_vehicle_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles USING btree (vehicle_registration_province);


--
-- TOC entry 4835 (class 1259 OID 16752)
-- Name: idx_rider_profiles_vehicle_registration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles USING btree (vehicle_registration_number);


--
-- TOC entry 4855 (class 2620 OID 16748)
-- Name: rider_addresses update_rider_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_addresses_updated_at BEFORE UPDATE ON public.rider_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4856 (class 2620 OID 16749)
-- Name: rider_profiles update_rider_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4850 (class 2606 OID 16764)
-- Name: markets fk_admin; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 4852 (class 2606 OID 16704)
-- Name: rider_addresses fk_rider_addresses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT fk_rider_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4853 (class 2606 OID 16735)
-- Name: rider_profiles fk_rider_profiles_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES public.admins(id);


--
-- TOC entry 4854 (class 2606 OID 16730)
-- Name: rider_profiles fk_rider_profiles_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4848 (class 2606 OID 16676)
-- Name: food_options food_options_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_options
    ADD CONSTRAINT food_options_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 4849 (class 2606 OID 16681)
-- Name: foods foods_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 4851 (class 2606 OID 16686)
-- Name: markets markets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


-- Completed on 2025-09-13 17:11:10

--
-- PostgreSQL database dump complete
--

