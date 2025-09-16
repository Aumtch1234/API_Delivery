--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-09-15 21:00:23

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
-- TOC entry 239 (class 1255 OID 16771)
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
-- TOC entry 217 (class 1259 OID 16772)
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
-- TOC entry 218 (class 1259 OID 16778)
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
-- TOC entry 5073 (class 0 OID 0)
-- Dependencies: 218
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 219 (class 1259 OID 16779)
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
-- TOC entry 220 (class 1259 OID 16786)
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
-- TOC entry 5074 (class 0 OID 0)
-- Dependencies: 220
-- Name: carts_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carts_cart_id_seq OWNED BY public.carts.cart_id;


--
-- TOC entry 221 (class 1259 OID 16787)
-- Name: categorys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorys (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.categorys OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16790)
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
-- TOC entry 5075 (class 0 OID 0)
-- Dependencies: 222
-- Name: categorys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorys_id_seq OWNED BY public.categorys.id;


--
-- TOC entry 223 (class 1259 OID 16791)
-- Name: client_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    address text NOT NULL,
    district character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    postal_code character varying(10) NOT NULL,
    notes text,
    latitude double precision,
    longitude double precision,
    location_text text,
    created_at timestamp without time zone DEFAULT now(),
    set_address boolean
);


ALTER TABLE public.client_addresses OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16797)
-- Name: client_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_addresses_id_seq OWNER TO postgres;

--
-- TOC entry 5076 (class 0 OID 0)
-- Dependencies: 224
-- Name: client_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_addresses_id_seq OWNED BY public.client_addresses.id;


--
-- TOC entry 225 (class 1259 OID 16798)
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
-- TOC entry 226 (class 1259 OID 16805)
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
-- TOC entry 5077 (class 0 OID 0)
-- Dependencies: 226
-- Name: foods_food_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.foods_food_id_seq OWNED BY public.foods.food_id;


--
-- TOC entry 227 (class 1259 OID 16806)
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
-- TOC entry 228 (class 1259 OID 16816)
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
-- TOC entry 5078 (class 0 OID 0)
-- Dependencies: 228
-- Name: markets_market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.markets_market_id_seq OWNED BY public.markets.market_id;


--
-- TOC entry 238 (class 1259 OID 17030)
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    order_id integer NOT NULL,
    user_id integer,
    market_id integer,
    rider_id integer,
    address text,
    delivery_type character varying(50),
    payment_method character varying(50),
    note text,
    distance_km numeric(10,2),
    delivery_fee numeric(10,2),
    total_price numeric(10,2),
    status character varying(50) DEFAULT 'pending'::character varying,
    items jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 17029)
-- Name: orders_order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_order_id_seq OWNER TO postgres;

--
-- TOC entry 5079 (class 0 OID 0)
-- Dependencies: 237
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- TOC entry 229 (class 1259 OID 16817)
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
-- TOC entry 5080 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE rider_addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_addresses IS 'ตารางเก็บที่อยู่ของไรเดอร์';


--
-- TOC entry 5081 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN rider_addresses.subdistrict; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.subdistrict IS 'ตำบล';


--
-- TOC entry 5082 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN rider_addresses.district; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.district IS 'อำเภอ';


--
-- TOC entry 5083 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN rider_addresses.province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.province IS 'จังหวัด';


--
-- TOC entry 230 (class 1259 OID 16825)
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
-- TOC entry 5084 (class 0 OID 0)
-- Dependencies: 230
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_addresses_address_id_seq OWNED BY public.rider_addresses.address_id;


--
-- TOC entry 231 (class 1259 OID 16826)
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
    gp_balance numeric(10,2) DEFAULT 0,
    CONSTRAINT chk_approval_status CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chk_vehicle_type CHECK ((vehicle_type = 'motorcycle'::text))
);


ALTER TABLE public.rider_profiles OWNER TO postgres;

--
-- TOC entry 5085 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE rider_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_profiles IS 'ตารางเก็บข้อมูลไรเดอร์ที่ต้องการยืนยันตัวตน';


--
-- TOC entry 5086 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.id_card_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_photo_url IS 'รูปถ่ายบัตรประชาชน';


--
-- TOC entry 5087 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.id_card_selfie_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_selfie_url IS 'รูปถ่ายคู่บัตรประชาชน';


--
-- TOC entry 5088 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.driving_license_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.driving_license_photo_url IS 'รูปใบขับขี่';


--
-- TOC entry 5089 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.vehicle_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_type IS 'ประเภทรถ (ปัจจุบันรองรับแค่ motorcycle)';


--
-- TOC entry 5090 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.vehicle_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_photo_url IS 'รูปถ่ายรถ';


--
-- TOC entry 5091 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.vehicle_registration_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_photo_url IS 'รูปคู่มือทะเบียนรถ';


--
-- TOC entry 5092 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.vehicle_registration_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';


--
-- TOC entry 5093 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.vehicle_registration_province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';


--
-- TOC entry 5094 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rider_profiles.promptpay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.promptpay IS 'หมายเลข PromptPay (เบอร์โทร 10 หลักหรือเลขบัตรประชาชน 13 หลัก)';


--
-- TOC entry 232 (class 1259 OID 16839)
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
-- TOC entry 5095 (class 0 OID 0)
-- Dependencies: 232
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_profiles_rider_id_seq OWNED BY public.rider_profiles.rider_id;


--
-- TOC entry 236 (class 1259 OID 16944)
-- Name: rider_topups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rider_topups (
    topup_id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    slip_url text NOT NULL,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    admin_id integer,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    rider_id integer,
    CONSTRAINT rider_topups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


ALTER TABLE public.rider_topups OWNER TO postgres;

--
-- TOC entry 5096 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE rider_topups; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_topups IS 'ตารางเก็บข้อมูลการเติมเงิน GP ของไรเดอร์';


--
-- TOC entry 5097 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN rider_topups.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.user_id IS 'รหัสผู้ใช้ที่เป็นไรเดอร์ (อ้างอิงจาก users table)';


--
-- TOC entry 5098 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN rider_topups.rider_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.rider_id IS 'รหัสไรเดอร์ (อ้างอิงจาก rider_profiles table)';


--
-- TOC entry 235 (class 1259 OID 16943)
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rider_topups_topup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rider_topups_topup_id_seq OWNER TO postgres;

--
-- TOC entry 5099 (class 0 OID 0)
-- Dependencies: 235
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_topups_topup_id_seq OWNED BY public.rider_topups.topup_id;


--
-- TOC entry 233 (class 1259 OID 16840)
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
-- TOC entry 234 (class 1259 OID 16849)
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
-- TOC entry 5100 (class 0 OID 0)
-- Dependencies: 234
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 4793 (class 2604 OID 16850)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 4795 (class 2604 OID 16851)
-- Name: carts cart_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts ALTER COLUMN cart_id SET DEFAULT nextval('public.carts_cart_id_seq'::regclass);


--
-- TOC entry 4798 (class 2604 OID 16852)
-- Name: categorys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys ALTER COLUMN id SET DEFAULT nextval('public.categorys_id_seq'::regclass);


--
-- TOC entry 4799 (class 2604 OID 16853)
-- Name: client_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses ALTER COLUMN id SET DEFAULT nextval('public.client_addresses_id_seq'::regclass);


--
-- TOC entry 4801 (class 2604 OID 16854)
-- Name: foods food_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods ALTER COLUMN food_id SET DEFAULT nextval('public.foods_food_id_seq'::regclass);


--
-- TOC entry 4804 (class 2604 OID 16855)
-- Name: markets market_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets ALTER COLUMN market_id SET DEFAULT nextval('public.markets_market_id_seq'::regclass);


--
-- TOC entry 4831 (class 2604 OID 17033)
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- TOC entry 4810 (class 2604 OID 16856)
-- Name: rider_addresses address_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses ALTER COLUMN address_id SET DEFAULT nextval('public.rider_addresses_address_id_seq'::regclass);


--
-- TOC entry 4814 (class 2604 OID 16857)
-- Name: rider_profiles rider_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles ALTER COLUMN rider_id SET DEFAULT nextval('public.rider_profiles_rider_id_seq'::regclass);


--
-- TOC entry 4827 (class 2604 OID 16947)
-- Name: rider_topups topup_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups ALTER COLUMN topup_id SET DEFAULT nextval('public.rider_topups_topup_id_seq'::regclass);


--
-- TOC entry 4822 (class 2604 OID 16858)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 5046 (class 0 OID 16772)
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
-- TOC entry 5048 (class 0 OID 16779)
-- Dependencies: 219
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carts (cart_id, user_id, food_id, quantity, selected_options, note, total, created_at) FROM stdin;
25	31	20	1	[]		35	2025-09-12 12:20:12.162249
26	31	18	5	[{"label": "ไก่", "extraPrice": 10}]		180	2025-09-12 12:21:04.462235
27	31	19	2	[]		134	2025-09-12 13:19:45.275549
\.


--
-- TOC entry 5050 (class 0 OID 16787)
-- Dependencies: 221
-- Data for Name: categorys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorys (id, name) FROM stdin;
\.


--
-- TOC entry 5052 (class 0 OID 16791)
-- Dependencies: 223
-- Data for Name: client_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_addresses (id, user_id, name, phone, address, district, city, postal_code, notes, latitude, longitude, location_text, created_at, set_address) FROM stdin;
2	31	สุดหล่อจ่ะ	0989520103	74Q9+GCW อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.28956803546931	104.11867182701826	74Q9+GCW อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-13 16:30:15.754407	f
3	31	เสก สุดจะหล่อ	0987654321	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.286741935703482	104.11390386521816	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-13 18:03:41.179373	f
4	32	สุดจะทน	0879465312	74HJ+7JG 74HJ+7JG ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.2781712	104.1316336	74HJ+7JG 74HJ+7JG ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:04:29.922383	f
5	32	กับคนอย่างเธอ	0852134679	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.2863889	104.1127778	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:05:32.232987	f
6	32	อาร์ม	0986123547	74JC+6RC Unnamed Rd อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000	ตึก B	17.2805649	104.1220182	74JC+6RC Unnamed Rd อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:06:42.914712	t
7	31	สุดจัด	0849567312	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.26881945839936	104.13779195398092	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:13:49.04298	t
8	31	เฟียส	0982147653	74CG+G37 74CG+G37 ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000	หน้าร้าน ขายของชำ	17.271748923950433	104.12641134113073	74CG+G37 74CG+G37 ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:17:19.27141	f
\.


--
-- TOC entry 5054 (class 0 OID 16798)
-- Dependencies: 225
-- Data for Name: foods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.foods (food_id, market_id, food_name, price, image_url, created_at, options, rating, sell_price) FROM stdin;
18	37	ลาบะ	23.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614820/Market-LOGO/uxxu9ksyzmbjvejbiba6.jpg	2025-09-12 01:20:20.96686	[{"label": "ไก่", "extraPrice": 10}, {"label": "หมู", "extraPrice": 15}, {"label": "เนื้อ", "extraPrice": 20}, {"label": "เป็ด", "extraPrice": 40}]	\N	26.00
19	38	อ่อมหมู	59.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614871/Market-LOGO/ph5jwppwayvgmih9ohpc.jpg	2025-09-12 01:21:12.136991	[]	\N	67.00
20	37	ลข	31.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757654055/Market-LOGO/hwe1fcjovtxmkuyjh17n.jpg	2025-09-12 12:14:16.611986	[]	3.0	35.00
\.


--
-- TOC entry 5056 (class 0 OID 16806)
-- Dependencies: 227
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.markets (market_id, owner_id, shop_name, shop_description, shop_logo_url, created_at, latitude, longitude, open_time, close_time, is_open, is_manual_override, override_until, rating, address, phone, approve, admin_id, is_admin) FROM stdin;
38	\N	ร้านแอดมิน	ร้านแอดมิน เด้อจ่ะ แพงขึ้น 20%	https://res.cloudinary.com/djqdn2zru/image/upload/v1757608039/food-menu/hserelfmmpvtup06j3lb.jpg	2025-09-11 23:27:20.249612	13.736717	100.523186	\N	\N	f	f	\N	\N	23/1 เชียงเครือ	-	f	1	t
37	31	เสกสายเบิร์น (ย่าง)	ขายไก่ย่าง เนื้อย่าง ปลาเผา ส่งฟรี ส่งไว หอมอร่อย. 🏎️💥	https://res.cloudinary.com/djqdn2zru/image/upload/v1757491128/Market-LOGO/zegkbequ9px72yz8mdkn.jpg	2025-09-10 14:58:49.472311	17.27025890434053	104.13420014083385	14:00	20:30	f	f	\N	\N	42/6 เชียงเครือ หออะตอม 45801	0987654321	t	\N	f
\.


--
-- TOC entry 5067 (class 0 OID 17030)
-- Dependencies: 238
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (order_id, user_id, market_id, rider_id, address, delivery_type, payment_method, note, distance_km, delivery_fee, total_price, status, items, created_at) FROM stdin;
\.


--
-- TOC entry 5058 (class 0 OID 16817)
-- Dependencies: 229
-- Data for Name: rider_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_addresses (address_id, user_id, house_number, street, subdistrict, district, province, postal_code, is_default, created_at, updated_at) FROM stdin;
6	33	388	\N	เชียงเครือ	เมือง	สกล	\N	t	2025-09-15 19:44:35.294902	2025-09-15 19:44:35.294902
\.


--
-- TOC entry 5060 (class 0 OID 16826)
-- Dependencies: 231
-- Data for Name: rider_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_profiles (rider_id, user_id, id_card_number, id_card_photo_url, id_card_selfie_url, driving_license_number, driving_license_photo_url, vehicle_type, vehicle_brand_model, vehicle_color, vehicle_photo_url, vehicle_registration_photo_url, approval_status, approved_by, approved_at, rejection_reason, created_at, updated_at, vehicle_registration_number, vehicle_registration_province, promptpay, gp_balance) FROM stdin;
8	33	9901700123459	https://res.cloudinary.com/djqdn2zru/image/upload/v1757940397/rider-documents/ylvr2mhrx9epwrsiznsp.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1757940396/rider-documents/wnhgibedrjohamkz4jhh.png	DL1234568	https://res.cloudinary.com/djqdn2zru/image/upload/v1757940398/rider-documents/bl2qbcjojaopfojstmms.png	motorcycle	Honda Wave	Red	https://res.cloudinary.com/djqdn2zru/image/upload/v1757940399/rider-documents/tuxqgbjiqp4ckdgmxwro.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1757940401/rider-documents/iknribyr9jv0ksjklkvm.jpg	approved	1	2025-09-15 19:51:33.672205	\N	2025-09-15 19:46:33.74592	2025-09-15 19:51:33.672205	ฟก-123	สกลนคร	\N	0.00
\.


--
-- TOC entry 5065 (class 0 OID 16944)
-- Dependencies: 236
-- Data for Name: rider_topups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_topups (topup_id, user_id, amount, slip_url, status, rejection_reason, admin_id, approved_at, created_at, updated_at, rider_id) FROM stdin;
1	33	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757943216/rider-topup-slips/fcunitujzs187gcd2tnr.png	pending	\N	\N	\N	2025-09-15 20:54:03.134776	2025-09-15 20:54:03.134776	8
2	33	200.00	https://example.com/slip2.png	approved	\N	\N	\N	2025-09-15 20:54:03.134776	2025-09-15 20:54:03.134776	8
3	33	150.00	https://example.com/slip3.png	rejected	\N	\N	\N	2025-09-15 20:54:03.134776	2025-09-15 20:54:03.134776	8
4	33	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757944703/rider-topup-slips/a60z9stemnsxnm8kpmft.png	pending	\N	\N	\N	2025-09-15 20:58:23.89322	2025-09-15 20:58:23.89322	8
\.


--
-- TOC entry 5062 (class 0 OID 16840)
-- Dependencies: 233
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, google_id, display_name, email, password, birthdate, gender, phone, created_at, is_verified, photo_url, providers, is_seller, role) FROM stdin;
31	105392817902249087793	Taweechok KHAMPHUSA	taweechok.k@ku.th	\N	2003-07-06	0	0989520103	2025-09-10 14:42:48.63126	t	https://lh3.googleusercontent.com/a/ACg8ocLgf2QVH2faiqfFPK_Xm49JegXu7hTVP6EjlEZUj4a0Oy6KCF6W=s96-c	google	t	member
32	101628051506191273987	Taweechok Khamphusa	aumt1569@gmail.com	\N	\N	\N	\N	2025-09-10 20:09:47.358897	f	https://lh3.googleusercontent.com/a/ACg8ocJw8scPixF2PrzJUUzpznN9BOXF94U_ylti8av5jpEvQ9CN4g=s96-c	google	f	member
33	\N	เย้ๆ123	test@example.com	$2b$10$Z0A3DbqebFmIUVvQoJ/q6ucngyaAyRHMZAQs.qx.BM4eQCwv7vhPy	1990-01-01	0	123456789	2025-09-15 19:44:35.294902	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1757940277/rider-profiles/bvo5yzdffawrunos5fvw.png	\N	f	rider
\.


--
-- TOC entry 5101 (class 0 OID 0)
-- Dependencies: 218
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 14, true);


--
-- TOC entry 5102 (class 0 OID 0)
-- Dependencies: 220
-- Name: carts_cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carts_cart_id_seq', 27, true);


--
-- TOC entry 5103 (class 0 OID 0)
-- Dependencies: 222
-- Name: categorys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorys_id_seq', 1, false);


--
-- TOC entry 5104 (class 0 OID 0)
-- Dependencies: 224
-- Name: client_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.client_addresses_id_seq', 8, true);


--
-- TOC entry 5105 (class 0 OID 0)
-- Dependencies: 226
-- Name: foods_food_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.foods_food_id_seq', 20, true);


--
-- TOC entry 5106 (class 0 OID 0)
-- Dependencies: 228
-- Name: markets_market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.markets_market_id_seq', 38, true);


--
-- TOC entry 5107 (class 0 OID 0)
-- Dependencies: 237
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 1, false);


--
-- TOC entry 5108 (class 0 OID 0)
-- Dependencies: 230
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_addresses_address_id_seq', 6, true);


--
-- TOC entry 5109 (class 0 OID 0)
-- Dependencies: 232
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_profiles_rider_id_seq', 8, true);


--
-- TOC entry 5110 (class 0 OID 0)
-- Dependencies: 235
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_topups_topup_id_seq', 4, true);


--
-- TOC entry 5111 (class 0 OID 0)
-- Dependencies: 234
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 33, true);


--
-- TOC entry 4838 (class 2606 OID 16860)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 4840 (class 2606 OID 16862)
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- TOC entry 4842 (class 2606 OID 16864)
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (cart_id);


--
-- TOC entry 4844 (class 2606 OID 16866)
-- Name: categorys categorys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys
    ADD CONSTRAINT categorys_pkey PRIMARY KEY (id);


--
-- TOC entry 4846 (class 2606 OID 16868)
-- Name: client_addresses client_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses
    ADD CONSTRAINT client_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 4848 (class 2606 OID 16870)
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (food_id);


--
-- TOC entry 4850 (class 2606 OID 16872)
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (market_id);


--
-- TOC entry 4884 (class 2606 OID 17039)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 4855 (class 2606 OID 16874)
-- Name: rider_addresses rider_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT rider_addresses_pkey PRIMARY KEY (address_id);


--
-- TOC entry 4864 (class 2606 OID 16876)
-- Name: rider_profiles rider_profiles_driving_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_driving_license_number_key UNIQUE (driving_license_number);


--
-- TOC entry 4866 (class 2606 OID 16878)
-- Name: rider_profiles rider_profiles_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_id_card_number_key UNIQUE (id_card_number);


--
-- TOC entry 4868 (class 2606 OID 16880)
-- Name: rider_profiles rider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_pkey PRIMARY KEY (rider_id);


--
-- TOC entry 4870 (class 2606 OID 16882)
-- Name: rider_profiles rider_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 4882 (class 2606 OID 16955)
-- Name: rider_topups rider_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_pkey PRIMARY KEY (topup_id);


--
-- TOC entry 4872 (class 2606 OID 16884)
-- Name: rider_profiles unique_vehicle_registration; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT unique_vehicle_registration UNIQUE (vehicle_registration_number, vehicle_registration_province);


--
-- TOC entry 4874 (class 2606 OID 16886)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4876 (class 2606 OID 16888)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4851 (class 1259 OID 16889)
-- Name: idx_rider_addresses_district; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_district ON public.rider_addresses USING btree (district, province);


--
-- TOC entry 4852 (class 1259 OID 16890)
-- Name: idx_rider_addresses_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_province ON public.rider_addresses USING btree (province);


--
-- TOC entry 4853 (class 1259 OID 16891)
-- Name: idx_rider_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_user_id ON public.rider_addresses USING btree (user_id);


--
-- TOC entry 4856 (class 1259 OID 16892)
-- Name: idx_rider_profiles_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_approval_status ON public.rider_profiles USING btree (approval_status);


--
-- TOC entry 4857 (class 1259 OID 16893)
-- Name: idx_rider_profiles_driving_license_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_driving_license_number ON public.rider_profiles USING btree (driving_license_number);


--
-- TOC entry 4858 (class 1259 OID 16894)
-- Name: idx_rider_profiles_id_card_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_id_card_number ON public.rider_profiles USING btree (id_card_number);


--
-- TOC entry 4859 (class 1259 OID 16895)
-- Name: idx_rider_profiles_promptpay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_promptpay ON public.rider_profiles USING btree (promptpay);


--
-- TOC entry 4860 (class 1259 OID 16896)
-- Name: idx_rider_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_user_id ON public.rider_profiles USING btree (user_id);


--
-- TOC entry 4861 (class 1259 OID 16897)
-- Name: idx_rider_profiles_vehicle_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles USING btree (vehicle_registration_province);


--
-- TOC entry 4862 (class 1259 OID 16898)
-- Name: idx_rider_profiles_vehicle_registration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles USING btree (vehicle_registration_number);


--
-- TOC entry 4877 (class 1259 OID 17062)
-- Name: idx_rider_topups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_created_at ON public.rider_topups USING btree (created_at);


--
-- TOC entry 4878 (class 1259 OID 17069)
-- Name: idx_rider_topups_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_rider_id ON public.rider_topups USING btree (rider_id);


--
-- TOC entry 4879 (class 1259 OID 17061)
-- Name: idx_rider_topups_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_status ON public.rider_topups USING btree (status);


--
-- TOC entry 4880 (class 1259 OID 17060)
-- Name: idx_rider_topups_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_user_id ON public.rider_topups USING btree (user_id);


--
-- TOC entry 4899 (class 2620 OID 16899)
-- Name: rider_addresses update_rider_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_addresses_updated_at BEFORE UPDATE ON public.rider_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4900 (class 2620 OID 16900)
-- Name: rider_profiles update_rider_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4885 (class 2606 OID 16901)
-- Name: carts carts_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 4886 (class 2606 OID 16906)
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4888 (class 2606 OID 16911)
-- Name: markets fk_admin; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 4890 (class 2606 OID 16916)
-- Name: rider_addresses fk_rider_addresses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT fk_rider_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4891 (class 2606 OID 16921)
-- Name: rider_profiles fk_rider_profiles_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES public.admins(id);


--
-- TOC entry 4892 (class 2606 OID 16926)
-- Name: rider_profiles fk_rider_profiles_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4887 (class 2606 OID 16931)
-- Name: foods foods_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 4889 (class 2606 OID 16936)
-- Name: markets markets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


--
-- TOC entry 4896 (class 2606 OID 17045)
-- Name: orders orders_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id);


--
-- TOC entry 4897 (class 2606 OID 17050)
-- Name: orders orders_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id);


--
-- TOC entry 4898 (class 2606 OID 17040)
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 4893 (class 2606 OID 16961)
-- Name: rider_topups rider_topups_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 4894 (class 2606 OID 17064)
-- Name: rider_topups rider_topups_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id);


--
-- TOC entry 4895 (class 2606 OID 17055)
-- Name: rider_topups rider_topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


-- Completed on 2025-09-15 21:00:23

--
-- PostgreSQL database dump complete
--

