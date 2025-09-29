--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-09-27 23:42:40

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
-- TOC entry 253 (class 1255 OID 17499)
-- Name: _after_market_review_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._after_market_review_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM public.recompute_market_rating( CASE WHEN TG_OP='DELETE' THEN OLD.market_id ELSE NEW.market_id END );
  RETURN NULL;
END;
$$;


ALTER FUNCTION public._after_market_review_change() OWNER TO postgres;

--
-- TOC entry 254 (class 1255 OID 17501)
-- Name: _after_rider_review_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._after_rider_review_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM public.recompute_rider_rating( CASE WHEN TG_OP='DELETE' THEN OLD.rider_id ELSE NEW.rider_id END );
  RETURN NULL;
END;
$$;


ALTER FUNCTION public._after_rider_review_change() OWNER TO postgres;

--
-- TOC entry 249 (class 1255 OID 17130)
-- Name: notify_order_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_order_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- ส่ง notification พร้อมข้อมูล order
    PERFORM pg_notify(
        'order_updated',
        json_build_object(
            'order_id', NEW.order_id,
            'status', NEW.status,
            'rider_id', NEW.rider_id,
            'shop_id', NEW.shop_id,
            'hasShop', (NEW.status != 'pending'),
            'hasRider', (NEW.rider_id IS NOT NULL),
            'action', TG_OP,
            'timestamp', EXTRACT(EPOCH FROM NOW())
        )::text
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_order_update() OWNER TO postgres;

--
-- TOC entry 251 (class 1255 OID 17497)
-- Name: recompute_market_rating(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recompute_market_rating(p_market_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.markets m
  SET
    rating = COALESCE(ROUND( (SELECT AVG(r.rating)::numeric FROM public.market_reviews r WHERE r.market_id = p_market_id ), 1), 0),
    reviews_count = (SELECT CAST(COUNT(*) AS integer) FROM public.market_reviews r WHERE r.market_id = p_market_id)
  WHERE m.market_id = p_market_id;
END;
$$;


ALTER FUNCTION public.recompute_market_rating(p_market_id integer) OWNER TO postgres;

--
-- TOC entry 252 (class 1255 OID 17498)
-- Name: recompute_rider_rating(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recompute_rider_rating(p_rider_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.rider_profiles r
  SET
    rating = COALESCE(ROUND( (SELECT AVG(rv.rating)::numeric FROM public.rider_reviews rv WHERE rv.rider_id = p_rider_id ), 1), 0),
    reviews_count = (SELECT CAST(COUNT(*) AS integer) FROM public.rider_reviews rv WHERE rv.rider_id = p_rider_id)
  WHERE r.rider_id = p_rider_id;
END;
$$;


ALTER FUNCTION public.recompute_rider_rating(p_rider_id integer) OWNER TO postgres;

--
-- TOC entry 250 (class 1255 OID 17131)
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

--
-- TOC entry 267 (class 1255 OID 17493)
-- Name: validate_market_review(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_market_review() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  o RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE order_id = NEW.order_id;

  IF o IS NULL THEN
    RAISE EXCEPTION 'Order % not found', NEW.order_id;
  END IF;

  -- ต้องเป็นเจ้าของออเดอร์
  IF o.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'User % is not owner of order %', NEW.user_id, NEW.order_id;
  END IF;

  -- สถานะต้อง completed
  IF o.status <> 'completed' THEN
    RAISE EXCEPTION 'Order % is not completed (status=%).', NEW.order_id, o.status;
  END IF;

  -- market_id ต้องตรงกับออเดอร์
  IF o.market_id IS NULL OR o.market_id <> NEW.market_id THEN
    RAISE EXCEPTION 'market_id mismatch for order %', NEW.order_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_market_review() OWNER TO postgres;

--
-- TOC entry 255 (class 1255 OID 17495)
-- Name: validate_rider_review(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_rider_review() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  o RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE order_id = NEW.order_id;

  IF o IS NULL THEN
    RAISE EXCEPTION 'Order % not found', NEW.order_id;
  END IF;

  -- ต้องเป็นเจ้าของออเดอร์
  IF o.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'User % is not owner of order %', NEW.user_id, NEW.order_id;
  END IF;

  -- สถานะต้อง completed
  IF o.status <> 'completed' THEN
    RAISE EXCEPTION 'Order % is not completed (status=%).', NEW.order_id, o.status;
  END IF;

  -- ต้องมี rider_id ในออเดอร์ และตรงกัน
  IF o.rider_id IS NULL OR o.rider_id <> NEW.rider_id THEN
    RAISE EXCEPTION 'No rider assigned or rider mismatch for order %', NEW.order_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_rider_review() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 17132)
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
-- TOC entry 218 (class 1259 OID 17138)
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
-- TOC entry 5189 (class 0 OID 0)
-- Dependencies: 218
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 219 (class 1259 OID 17139)
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
-- TOC entry 220 (class 1259 OID 17146)
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
-- TOC entry 5190 (class 0 OID 0)
-- Dependencies: 220
-- Name: carts_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carts_cart_id_seq OWNED BY public.carts.cart_id;


--
-- TOC entry 221 (class 1259 OID 17147)
-- Name: categorys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorys (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.categorys OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 17150)
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
-- TOC entry 5191 (class 0 OID 0)
-- Dependencies: 222
-- Name: categorys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorys_id_seq OWNED BY public.categorys.id;


--
-- TOC entry 244 (class 1259 OID 17400)
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    message_id integer NOT NULL,
    room_id integer NOT NULL,
    sender_id integer NOT NULL,
    sender_type character varying(20) NOT NULL,
    message_text text,
    message_type character varying(20) DEFAULT 'text'::character varying,
    image_url text,
    latitude double precision,
    longitude double precision,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sender_type CHECK (((sender_type)::text = ANY ((ARRAY['customer'::character varying, 'rider'::character varying])::text[])))
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 17399)
-- Name: chat_messages_message_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_messages_message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_message_id_seq OWNER TO postgres;

--
-- TOC entry 5192 (class 0 OID 0)
-- Dependencies: 243
-- Name: chat_messages_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_message_id_seq OWNED BY public.chat_messages.message_id;


--
-- TOC entry 242 (class 1259 OID 17373)
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_rooms (
    room_id integer NOT NULL,
    order_id integer NOT NULL,
    customer_id integer NOT NULL,
    rider_id integer NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_rooms OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 17372)
-- Name: chat_rooms_room_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_rooms_room_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_rooms_room_id_seq OWNER TO postgres;

--
-- TOC entry 5193 (class 0 OID 0)
-- Dependencies: 241
-- Name: chat_rooms_room_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_rooms_room_id_seq OWNED BY public.chat_rooms.room_id;


--
-- TOC entry 223 (class 1259 OID 17151)
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
-- TOC entry 224 (class 1259 OID 17157)
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
-- TOC entry 5194 (class 0 OID 0)
-- Dependencies: 224
-- Name: client_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_addresses_id_seq OWNED BY public.client_addresses.id;


--
-- TOC entry 225 (class 1259 OID 17158)
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
    sell_price numeric(10,2),
    sell_options jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.foods OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 17165)
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
-- TOC entry 5195 (class 0 OID 0)
-- Dependencies: 226
-- Name: foods_food_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.foods_food_id_seq OWNED BY public.foods.food_id;


--
-- TOC entry 246 (class 1259 OID 17432)
-- Name: market_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_reviews (
    review_id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    market_id integer NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT market_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.market_reviews OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 17431)
-- Name: market_reviews_review_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.market_reviews_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.market_reviews_review_id_seq OWNER TO postgres;

--
-- TOC entry 5196 (class 0 OID 0)
-- Dependencies: 245
-- Name: market_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.market_reviews_review_id_seq OWNED BY public.market_reviews.review_id;


--
-- TOC entry 227 (class 1259 OID 17166)
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
    is_admin boolean DEFAULT false,
    reviews_count integer DEFAULT 0
);


ALTER TABLE public.markets OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 17176)
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
-- TOC entry 5197 (class 0 OID 0)
-- Dependencies: 228
-- Name: markets_market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.markets_market_id_seq OWNED BY public.markets.market_id;


--
-- TOC entry 229 (class 1259 OID 17177)
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    item_id integer NOT NULL,
    order_id integer,
    food_id integer,
    food_name character varying(255),
    quantity integer,
    sell_price numeric(10,2),
    subtotal numeric(10,2),
    selected_options jsonb DEFAULT '[]'::jsonb,
    original_price numeric(10,2) DEFAULT 0.00,
    original_subtotal numeric(10,2) DEFAULT 0.00,
    original_options jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- TOC entry 5198 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN order_items.original_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_price IS 'ราคาต้นทุนก่อนบวก%เพิ่ม';


--
-- TOC entry 5199 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN order_items.original_subtotal; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_subtotal IS 'ราคารวมต้นทุนก่อนบวก%เพิ่ม (original_price * quantity)';


--
-- TOC entry 5200 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN order_items.original_options; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_options IS 'ตัวเลือกอาหารราคาต้นทุนก่อนบวก%เพิ่ม';


--
-- TOC entry 230 (class 1259 OID 17183)
-- Name: order_items_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_item_id_seq OWNER TO postgres;

--
-- TOC entry 5201 (class 0 OID 0)
-- Dependencies: 230
-- Name: order_items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_item_id_seq OWNED BY public.order_items.item_id;


--
-- TOC entry 231 (class 1259 OID 17184)
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    market_id integer,
    rider_id integer,
    address text NOT NULL,
    delivery_type character varying(100),
    payment_method character varying(50),
    note text,
    distance_km numeric(10,2),
    delivery_fee numeric(10,2),
    total_price numeric(10,2),
    status character varying(50) DEFAULT 'waiting'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    address_id integer,
    rider_required_gp numeric(10,2) DEFAULT 0.00,
    bonus numeric(10,2) DEFAULT 0.00,
    original_total_price numeric(10,2) DEFAULT 0.00
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 5202 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN orders.original_total_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.original_total_price IS 'ราคารวมต้นทุนก่อนบวก%เพิ่ม (ไม่รวมค่าส่ง)';


--
-- TOC entry 232 (class 1259 OID 17192)
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
-- TOC entry 5203 (class 0 OID 0)
-- Dependencies: 232
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- TOC entry 233 (class 1259 OID 17193)
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
-- TOC entry 5204 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE rider_addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_addresses IS 'ตารางเก็บที่อยู่ของไรเดอร์';


--
-- TOC entry 5205 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rider_addresses.subdistrict; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.subdistrict IS 'ตำบล';


--
-- TOC entry 5206 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rider_addresses.district; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.district IS 'อำเภอ';


--
-- TOC entry 5207 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rider_addresses.province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.province IS 'จังหวัด';


--
-- TOC entry 234 (class 1259 OID 17201)
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
-- TOC entry 5208 (class 0 OID 0)
-- Dependencies: 234
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_addresses_address_id_seq OWNED BY public.rider_addresses.address_id;


--
-- TOC entry 235 (class 1259 OID 17202)
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
    gp_balance numeric(10,2) DEFAULT 0.00,
    rating numeric(2,1),
    reviews_count integer DEFAULT 0,
    CONSTRAINT chk_approval_status CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chk_vehicle_type CHECK ((vehicle_type = 'motorcycle'::text))
);


ALTER TABLE public.rider_profiles OWNER TO postgres;

--
-- TOC entry 5209 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE rider_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_profiles IS 'ตารางเก็บข้อมูลไรเดอร์ที่ต้องการยืนยันตัวตน';


--
-- TOC entry 5210 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.id_card_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_photo_url IS 'รูปถ่ายบัตรประชาชน';


--
-- TOC entry 5211 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.id_card_selfie_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_selfie_url IS 'รูปถ่ายคู่บัตรประชาชน';


--
-- TOC entry 5212 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.driving_license_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.driving_license_photo_url IS 'รูปใบขับขี่';


--
-- TOC entry 5213 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.vehicle_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_type IS 'ประเภทรถ (ปัจจุบันรองรับแค่ motorcycle)';


--
-- TOC entry 5214 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.vehicle_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_photo_url IS 'รูปถ่ายรถ';


--
-- TOC entry 5215 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.vehicle_registration_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_photo_url IS 'รูปคู่มือทะเบียนรถ';


--
-- TOC entry 5216 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.vehicle_registration_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';


--
-- TOC entry 5217 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.vehicle_registration_province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';


--
-- TOC entry 5218 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN rider_profiles.promptpay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.promptpay IS 'หมายเลข PromptPay (เบอร์โทร 10 หลักหรือเลขบัตรประชาชน 13 หลัก)';


--
-- TOC entry 236 (class 1259 OID 17216)
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
-- TOC entry 5219 (class 0 OID 0)
-- Dependencies: 236
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_profiles_rider_id_seq OWNED BY public.rider_profiles.rider_id;


--
-- TOC entry 248 (class 1259 OID 17463)
-- Name: rider_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rider_reviews (
    review_id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    rider_id integer NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT rider_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.rider_reviews OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 17462)
-- Name: rider_reviews_review_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rider_reviews_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rider_reviews_review_id_seq OWNER TO postgres;

--
-- TOC entry 5220 (class 0 OID 0)
-- Dependencies: 247
-- Name: rider_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_reviews_review_id_seq OWNED BY public.rider_reviews.review_id;


--
-- TOC entry 237 (class 1259 OID 17217)
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
-- TOC entry 5221 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE rider_topups; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_topups IS 'ตารางเก็บข้อมูลการเติมเงิน GP ของไรเดอร์';


--
-- TOC entry 5222 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN rider_topups.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.user_id IS 'รหัสผู้ใช้ที่เป็นไรเดอร์ (อ้างอิงจาก users table)';


--
-- TOC entry 5223 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN rider_topups.rider_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.rider_id IS 'รหัสไรเดอร์ (อ้างอิงจาก rider_profiles table)';


--
-- TOC entry 238 (class 1259 OID 17226)
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
-- TOC entry 5224 (class 0 OID 0)
-- Dependencies: 238
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_topups_topup_id_seq OWNED BY public.rider_topups.topup_id;


--
-- TOC entry 239 (class 1259 OID 17227)
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
    role text DEFAULT 'member'::text,
    fcm_token text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 17236)
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
-- TOC entry 5225 (class 0 OID 0)
-- Dependencies: 240
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 4825 (class 2604 OID 17237)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 4827 (class 2604 OID 17238)
-- Name: carts cart_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts ALTER COLUMN cart_id SET DEFAULT nextval('public.carts_cart_id_seq'::regclass);


--
-- TOC entry 4830 (class 2604 OID 17239)
-- Name: categorys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys ALTER COLUMN id SET DEFAULT nextval('public.categorys_id_seq'::regclass);


--
-- TOC entry 4882 (class 2604 OID 17403)
-- Name: chat_messages message_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN message_id SET DEFAULT nextval('public.chat_messages_message_id_seq'::regclass);


--
-- TOC entry 4878 (class 2604 OID 17376)
-- Name: chat_rooms room_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms ALTER COLUMN room_id SET DEFAULT nextval('public.chat_rooms_room_id_seq'::regclass);


--
-- TOC entry 4831 (class 2604 OID 17240)
-- Name: client_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses ALTER COLUMN id SET DEFAULT nextval('public.client_addresses_id_seq'::regclass);


--
-- TOC entry 4833 (class 2604 OID 17241)
-- Name: foods food_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods ALTER COLUMN food_id SET DEFAULT nextval('public.foods_food_id_seq'::regclass);


--
-- TOC entry 4886 (class 2604 OID 17435)
-- Name: market_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.market_reviews_review_id_seq'::regclass);


--
-- TOC entry 4837 (class 2604 OID 17242)
-- Name: markets market_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets ALTER COLUMN market_id SET DEFAULT nextval('public.markets_market_id_seq'::regclass);


--
-- TOC entry 4844 (class 2604 OID 17243)
-- Name: order_items item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN item_id SET DEFAULT nextval('public.order_items_item_id_seq'::regclass);


--
-- TOC entry 4849 (class 2604 OID 17244)
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- TOC entry 4856 (class 2604 OID 17245)
-- Name: rider_addresses address_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses ALTER COLUMN address_id SET DEFAULT nextval('public.rider_addresses_address_id_seq'::regclass);


--
-- TOC entry 4860 (class 2604 OID 17246)
-- Name: rider_profiles rider_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles ALTER COLUMN rider_id SET DEFAULT nextval('public.rider_profiles_rider_id_seq'::regclass);


--
-- TOC entry 4889 (class 2604 OID 17466)
-- Name: rider_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.rider_reviews_review_id_seq'::regclass);


--
-- TOC entry 4869 (class 2604 OID 17247)
-- Name: rider_topups topup_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups ALTER COLUMN topup_id SET DEFAULT nextval('public.rider_topups_topup_id_seq'::regclass);


--
-- TOC entry 4873 (class 2604 OID 17248)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 5152 (class 0 OID 17132)
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
-- TOC entry 5154 (class 0 OID 17139)
-- Dependencies: 219
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carts (cart_id, user_id, food_id, quantity, selected_options, note, total, created_at) FROM stdin;
119	35	25	1	[{"label": "code", "extraPrice": 12}]		70	2025-09-26 15:59:03.801981
\.


--
-- TOC entry 5156 (class 0 OID 17147)
-- Dependencies: 221
-- Data for Name: categorys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorys (id, name) FROM stdin;
\.


--
-- TOC entry 5179 (class 0 OID 17400)
-- Dependencies: 244
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (message_id, room_id, sender_id, sender_type, message_text, message_type, image_url, latitude, longitude, is_read, created_at) FROM stdin;
6	9	36	customer	สวัสดีจากลูกค้า	text	\N	\N	\N	t	2025-09-25 12:20:31.957189
7	9	35	rider	สวัสดีจากลูกค้า	text	\N	\N	\N	t	2025-09-25 12:22:26.551758
\.


--
-- TOC entry 5177 (class 0 OID 17373)
-- Dependencies: 242
-- Data for Name: chat_rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_rooms (room_id, order_id, customer_id, rider_id, status, created_at, updated_at) FROM stdin;
9	91	36	10	active	2025-09-25 12:18:21.608914	2025-09-25 15:22:18.864823
\.


--
-- TOC entry 5158 (class 0 OID 17151)
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
9	34	1	s	80101 Agate จ.Colorado 80101	s	Colorado	80101		39.378044746158864	-104.16305501013994	80101 Agate จ.Colorado 80101	2025-09-19 17:44:13.568528	t
13	35	มาเล่น	0871676488	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	อำเภออินทร์บุรี	สิงห์บุรี	16110		15.072804051207106	100.35490293055773	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	2025-09-26 15:46:42.141682	t
10	36	มาเฟีย	0924387042	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	Kawthoung	Tanintharyi Region	49000	อะไรหรอ	11.26445733956247	98.78665890544653	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	2025-09-19 18:09:27.014042	t
\.


--
-- TOC entry 5160 (class 0 OID 17158)
-- Dependencies: 225
-- Data for Name: foods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.foods (food_id, market_id, food_name, price, image_url, created_at, options, rating, sell_price, sell_options) FROM stdin;
18	37	ลาบะ	23.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614820/Market-LOGO/uxxu9ksyzmbjvejbiba6.jpg	2025-09-12 01:20:20.96686	[{"label": "ไก่", "extraPrice": 10}, {"label": "หมู", "extraPrice": 15}, {"label": "เนื้อ", "extraPrice": 20}, {"label": "เป็ด", "extraPrice": 40}]	\N	26.00	[]
20	37	ลข	31.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757654055/Market-LOGO/hwe1fcjovtxmkuyjh17n.jpg	2025-09-12 12:14:16.611986	[]	3.0	35.00	[]
21	39	ข้าวสวย	40.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758281505/Market-LOGO/gaglreb9e95cl28nqt9q.jpg	2025-09-19 18:31:46.878776	[{"label": "แมว", "extraPrice": 7.0}]	\N	46.00	[]
22	40	วัว	98.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758282287/Market-LOGO/tnslbyic4c81moiot6ln.jpg	2025-09-19 18:44:49.217367	[{"label": "หนังเค็ม", "extraPrice": 20.0}]	\N	112.00	[]
23	40	แกงควาย	59.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758297822/Market-LOGO/czebok5syxrx3donwjph.png	2025-09-19 23:03:44.613978	[]	\N	67.00	[]
25	43	code	50.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758361159/Market-LOGO/jmrem0pdsqccb2fboheu.jpg	2025-09-20 16:39:21.203733	[{"label": "code", "extraPrice": 10}, {"label": "java", "extraPrice": 6}]	\N	58.00	[{"label": "code", "extraPrice": 12}, {"label": "java", "extraPrice": 7}]
26	39	กระเพรานะจ๊ะ	55.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758776507/Market-LOGO/ipfozd0icgjtzqfwxqpf.jpg	2025-09-25 12:01:47.742719	[{"label": "ไข่ดาว", "extraPrice": 6}, {"label": "ไข่เจียว", "extraPrice": 10}, {"label": "ผัก", "extraPrice": 7}]	\N	64.00	[{"label": "ไข่ดาว", "extraPrice": 7}, {"label": "ไข่เจียว", "extraPrice": 12}, {"label": "ผัก", "extraPrice": 9}]
29	39	แกงไก่	23.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758799857/Market-LOGO/ttgl5jlvunk7zj8wmcpi.jpg	2025-09-25 18:30:58.512084	[{"label": "น้ำ", "extraPrice": 3}]	\N	27.00	[{"label": "น้ำ", "extraPrice": 4}]
28	39	ไก่น้อย	50.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758799728/Market-LOGO/sfg9x7jpbo6ohat0czxf.jpg	2025-09-25 18:28:49.173621	[{"label": "เผ็ด", "extraPrice": 10}, {"label": "ผัก", "extraPrice": 5}]	\N	58.00	[{"label": "เผ็ด", "extraPrice": 12}, {"label": "ผัก", "extraPrice": 6}]
19	38	อ่อมหมู	59.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614871/Market-LOGO/ph5jwppwayvgmih9ohpc.jpg	2025-09-12 01:21:12.136991	[]	\N	71.00	[]
27	39	พำ	51.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758799559/Market-LOGO/wopxqzgco2jgldgbydyv.jpg	2025-09-25 18:25:59.813235	[{"label": "พพ", "extraPrice": 3}, {"label": "กอ", "extraPrice": 8}]	\N	59.00	[{"label": "พพ", "extraPrice": 4}, {"label": "กอ", "extraPrice": 10}]
\.


--
-- TOC entry 5181 (class 0 OID 17432)
-- Dependencies: 246
-- Data for Name: market_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.market_reviews (review_id, order_id, user_id, market_id, rating, comment, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5162 (class 0 OID 17166)
-- Dependencies: 227
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.markets (market_id, owner_id, shop_name, shop_description, shop_logo_url, created_at, latitude, longitude, open_time, close_time, is_open, is_manual_override, override_until, rating, address, phone, approve, admin_id, is_admin, reviews_count) FROM stdin;
38	\N	ร้านแอดมิน	ร้านแอดมิน เด้อจ่ะ แพงขึ้น 20%	https://res.cloudinary.com/djqdn2zru/image/upload/v1757608039/food-menu/hserelfmmpvtup06j3lb.jpg	2025-09-11 23:27:20.249612	13.736717	100.523186	\N	\N	f	f	\N	\N	23/1 เชียงเครือ	-	f	1	t	0
37	31	เสกสายเบิร์น (ย่าง)	ขายไก่ย่าง เนื้อย่าง ปลาเผา ส่งฟรี ส่งไว หอมอร่อย. 🏎️💥	https://res.cloudinary.com/djqdn2zru/image/upload/v1757491128/Market-LOGO/zegkbequ9px72yz8mdkn.jpg	2025-09-10 14:58:49.472311	17.27025890434053	104.13420014083385	14:00	20:30	f	f	\N	\N	42/6 เชียงเครือ หออะตอม 45801	0987654321	t	\N	f	0
39	36	ร้ายแรง	ไฟ	https://res.cloudinary.com/djqdn2zru/image/upload/v1758281355/Market-LOGO/yaj8imgyyldu6v42fcb4.jpg	2025-09-19 18:29:17.243767	9.331589109000308	96.73587810248137	08:28	22:22	f	f	\N	\N	42/6 เชียงเครือ หออะตอม 45801	0716	t	1	f	0
43	35	122	122	https://res.cloudinary.com/djqdn2zru/image/upload/v1758360443/Market-LOGO/s8yir43xu0t8tbzptnj1.jpg	2025-09-20 16:27:25.266129	38.28260714608228	-93.04697670042515	16:26	23:26	f	f	\N	\N	122	122	t	1	f	0
40	34	สมรักษ์ไง	สวัสดีครับ	https://res.cloudinary.com/djqdn2zru/image/upload/v1758282179/Market-LOGO/x379jxfcblswkbgrcv2y.jpg	2025-09-19 18:43:00.668904	51.93657927318116	-100.27912449091673	04:42	23:59	t	f	\N	0.0	ศรีเกต	0984857628	t	1	f	0
\.


--
-- TOC entry 5164 (class 0 OID 17177)
-- Dependencies: 229
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (item_id, order_id, food_id, food_name, quantity, sell_price, subtotal, selected_options, original_price, original_subtotal, original_options) FROM stdin;
112	113	28	ไก่น้อย	1	58.00	58.00	[{"label": "ผัก", "extraPrice": 6}]	0.00	0.00	[{"label": "ผัก", "extraPrice": 6}]
113	114	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่ดาว", "extraPrice": 7}]	61.00	61.00	[{"label": "ไข่ดาว", "extraPrice": 6}, {"label": "ไข่เจียว", "extraPrice": 10}, {"label": "ผัก", "extraPrice": 7}]
114	115	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่เจียว", "extraPrice": 12}]	61.00	61.00	[{"label": "ไข่ดาว", "extraPrice": 6}]
115	116	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่เจียว", "extraPrice": 12}]	61.00	61.00	[{"label": "ไข่เจียว", "extraPrice": 6}]
116	117	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่เจียว", "extraPrice": 12}]	61.00	61.00	[{"label": "ไข่เจียว", "extraPrice": 6}]
117	118	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่เจียว", "extraPrice": 12}]	55.00	65.00	[{"label": "ไข่เจียว", "extraPrice": 10}]
118	119	26	กระเพรานะจ๊ะ	1	64.00	85.00	[{"label": "ไข่เจียว", "extraPrice": 12}, {"label": "ผัก", "extraPrice": 9}]	55.00	72.00	[{"label": "ไข่เจียว", "extraPrice": 10}, {"label": "ผัก", "extraPrice": 7}]
119	120	19	อ่อมหมู	1	71.00	71.00	[]	59.00	59.00	[]
120	121	26	กระเพรานะจ๊ะ	1	64.00	76.00	[{"label": "ไข่ดาว", "extraPrice": 5}, {"label": "ไข่เจียว", "extraPrice": 7}]	55.00	71.00	[{"label": "ไข่ดาว", "extraPrice": 6}, {"label": "ไข่เจียว", "extraPrice": 10}]
121	122	28	ไก่น้อย	1	58.00	58.00	[]	50.00	50.00	[]
83	85	21	ข้าวสวย	1	46.00	46.00	[]	39.10	39.10	[]
84	86	21	ข้าวสวย	1	46.00	46.00	[]	39.10	39.10	[]
85	87	21	ข้าวสวย	1	46.00	46.00	[{"label": "แมว", "extraPrice": 7}]	39.10	39.10	[]
86	88	21	ข้าวสวย	1	46.00	46.00	[]	39.10	39.10	[]
87	89	21	ข้าวสวย	1	46.00	46.00	[{"label": "แมว", "extraPrice": 7}]	39.10	39.10	[]
88	90	21	ข้าวสวย	1	46.00	46.00	[]	39.10	39.10	[]
89	91	21	ข้าวสวย	1	46.00	46.00	[]	39.10	39.10	[]
90	92	21	ข้าวสวย	1	46.00	46.00	[{"label": "แมว", "extraPrice": 7}]	39.10	39.10	[]
91	93	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่ดาว", "extraPrice": 5}, {"label": "ไข่เจียว", "extraPrice": 7}]	54.40	54.40	[]
92	93	21	ข้าวสวย	1	46.00	46.00	[{"label": "แมว", "extraPrice": 7}]	39.10	39.10	[]
93	94	26	กระเพรานะจ๊ะ	1	64.00	64.00	[]	54.40	54.40	[]
94	95	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่ดาว", "extraPrice": 5}, {"label": "ไข่เจียว", "extraPrice": 7}]	54.40	54.40	[]
95	96	27	พำ	1	59.00	59.00	[{"label": "พพ", "extraPrice": 4}, {"label": "กอ", "extraPrice": 10}]	50.15	50.15	[]
96	97	25	doe	1	57.00	57.00	[]	48.45	48.45	[]
97	98	25	code	1	58.00	58.00	[]	49.30	49.30	[]
98	99	25	code	1	58.00	58.00	[{"label": "code", "extraPrice": 12}, {"label": "java", "extraPrice": 7}]	49.30	49.30	[]
99	100	27	พำ	1	59.00	59.00	[{"label": "กอ", "extraPrice": 10}]	50.15	50.15	[]
100	101	25	code	1	58.00	58.00	[{"label": "code", "extraPrice": 12}, {"label": "java", "extraPrice": 7}]	49.30	49.30	[]
101	102	27	พำ	1	59.00	59.00	[{"label": "กอ", "extraPrice": 10}]	50.15	50.15	[]
102	103	25	code	1	58.00	58.00	[{"label": "java", "extraPrice": 7}]	49.30	49.30	[]
103	104	27	พำ	1	59.00	59.00	[]	50.15	50.15	[]
104	105	25	code	1	58.00	58.00	[]	49.30	49.30	[]
105	106	25	code	1	58.00	58.00	[]	49.30	49.30	[]
106	107	27	พำ	1	59.00	59.00	[{"label": "กอ", "extraPrice": 10}]	50.15	50.15	[]
107	108	25	code	1	58.00	58.00	[]	49.30	49.30	[]
108	109	26	กระเพรานะจ๊ะ	1	64.00	64.00	[{"label": "ไข่เจียว", "extraPrice": 12}]	54.40	54.40	[]
109	110	19	อ่อมหมู	1	67.00	67.00	[]	56.95	56.95	[]
110	111	19	อ่อมหมู	1	67.00	67.00	[]	56.95	56.95	[]
111	112	27	พำ	1	59.00	59.00	[{"label": "พพ", "extraPrice": 4}]	50.15	50.15	[]
\.


--
-- TOC entry 5166 (class 0 OID 17184)
-- Dependencies: 231
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (order_id, user_id, market_id, rider_id, address, delivery_type, payment_method, note, distance_km, delivery_fee, total_price, status, created_at, updated_at, address_id, rider_required_gp, bonus, original_total_price) FROM stdin;
113	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	โอน		0.00	10.00	74.00	cancelled	2025-09-27 18:17:09.205743	2025-09-27 19:11:38.768252	10	9.00	0.00	0.00
116	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	86.00	waiting	2025-09-27 19:37:00.477174	2025-09-27 19:37:00.477174	10	11.00	0.00	61.00
119	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	95.00	waiting	2025-09-27 20:48:33.178362	2025-09-27 20:48:33.178362	10	12.00	0.00	72.00
122	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	68.00	waiting	2025-09-27 23:11:42.158093	2025-09-27 23:11:42.158093	10	8.00	0.00	50.00
95	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	86.00	cancelled	2025-09-25 16:51:45.844605	2025-09-27 18:06:35.243118	10	11.00	0.00	64.60
94	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	74.00	cancelled	2025-09-25 16:48:41.273305	2025-09-27 18:06:37.543637	10	9.00	0.00	54.40
100	35	39	\N	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	79.00	cancelled	2025-09-26 16:05:24.347519	2025-09-27 18:06:40.630017	13	21.00	0.00	58.65
103	35	43	\N	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	75.00	waiting	2025-09-26 16:15:44.28134	2025-09-26 16:15:44.28134	13	19.00	0.00	55.25
89	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	ส่งถึงมือ/ออกมารับเอง	เงินสด		0.00	10.00	63.00	picked_up	2025-09-23 21:37:32.62412	2025-09-23 23:04:12.228293	10	0.00	0.00	45.05
86	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	ส่งถึงมือ/ออกมารับเอง	เงินสด		0.00	5.00	51.00	delivering	2025-09-23 18:07:00.511351	2025-09-23 23:11:29.141969	\N	0.00	0.00	39.10
92	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	ส่งถึงมือ/ออกมารับเอง	เงินสด	s	0.00	10.00	63.00	going_to_shop	2025-09-25 00:29:16.640591	2025-09-25 11:37:36.334583	10	0.00	0.00	45.05
101	35	43	\N	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	87.00	confirmed	2025-09-26 16:05:24.347519	2025-09-26 16:18:44.009048	13	21.00	0.00	65.45
91	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	ส่งถึงมือ/ออกมารับเอง	เงินสด	adda	0.00	10.00	56.00	completed	2025-09-23 21:59:48.516312	2025-09-25 00:23:00.520862	10	0.00	0.00	39.10
93	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	โอน		0.00	10.00	139.00	arrived_at_customer	2025-09-25 12:56:27.889086	2025-09-25 15:11:38.770717	10	0.00	0.00	109.65
98	35	43	\N	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	68.00	waiting	2025-09-26 15:46:51.662799	2025-09-26 15:46:51.662799	13	8.00	0.00	49.30
99	35	43	\N	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	87.00	waiting	2025-09-26 15:56:01.380836	2025-09-26 15:56:01.380836	13	11.00	0.00	65.45
102	35	39	\N	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	79.00	ready_for_pickup	2025-09-26 16:15:44.28134	2025-09-26 19:20:19.974987	13	19.00	0.00	58.65
90	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	56.00	picked_up	2025-09-23 21:51:10.808941	2025-09-23 22:04:48.639844	10	0.00	0.00	39.10
96	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	83.00	ready_for_pickup	2025-09-26 15:25:53.006182	2025-09-26 19:22:42.744239	10	10.00	0.00	62.05
88	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	5.00	51.00	picked_up	2025-09-23 18:29:43.592312	2025-09-23 22:31:45.778106	\N	0.00	0.00	39.10
85	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	กเ	0.00	5.00	51.00	completed	2025-09-23 17:58:29.155181	2025-09-23 23:46:52.681497	\N	0.00	0.00	39.10
87	36	39	10	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	5.00	58.00	picked_up	2025-09-23 18:09:28.517257	2025-09-23 22:42:09.247754	\N	0.00	0.00	45.05
106	36	43	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	68.00	cancelled	2025-09-26 20:00:40.129419	2025-09-26 20:02:37.315575	10	9.00	0.00	49.30
105	36	43	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	68.00	cancelled	2025-09-26 19:35:19.898152	2025-09-26 20:02:38.682419	10	16.00	0.00	49.30
107	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	79.00	cancelled	2025-09-26 20:00:40.151472	2025-09-26 20:02:41.173528	10	11.00	0.00	58.65
97	36	43	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	67.00	cancelled	2025-09-26 15:25:53.006182	2025-09-27 18:11:23.078695	10	10.00	0.00	48.45
114	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	81.00	cancelled	2025-09-27 19:16:15.982143	2025-09-27 19:27:28.069878	10	10.00	0.00	61.00
117	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	ส่งถึงมือ/ออกมารับเอง	เงินสด		0.00	10.00	86.00	waiting	2025-09-27 19:52:43.207978	2025-09-27 19:52:43.207978	10	11.00	0.00	61.00
104	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	69.00	cancelled	2025-09-26 19:35:19.898152	2025-09-26 20:02:43.944728	10	16.00	0.00	50.15
109	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	86.00	cancelled	2025-09-26 20:16:02.706602	2025-09-27 18:06:43.002577	10	11.00	0.00	64.60
112	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	73.00	cancelled	2025-09-26 21:17:13.366723	2025-09-27 18:06:47.108304	10	9.00	0.00	53.55
111	36	38	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	77.00	cancelled	2025-09-26 21:17:13.296681	2025-09-27 18:11:13.208412	10	13.00	0.00	56.95
110	36	38	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	77.00	cancelled	2025-09-26 21:14:42.224805	2025-09-27 18:11:16.136434	10	13.00	0.00	56.95
108	36	43	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด	CANCELLED: Canceled Order From Customer.	0.00	10.00	68.00	cancelled	2025-09-26 20:16:02.636314	2025-09-27 18:11:18.84697	10	8.00	0.00	49.30
115	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	โอน		0.00	10.00	86.00	waiting	2025-09-27 19:28:20.808123	2025-09-27 19:28:20.808123	10	11.00	0.00	61.00
118	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	86.00	waiting	2025-09-27 20:27:37.928291	2025-09-27 20:27:37.928291	10	11.00	0.00	65.00
120	36	38	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	81.00	waiting	2025-09-27 21:03:31.537308	2025-09-27 21:03:31.537308	10	14.00	0.00	59.00
121	36	39	\N	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	แบบ/วางไว้จุดที่ระบุ	เงินสด		0.00	10.00	86.00	waiting	2025-09-27 21:03:31.554765	2025-09-27 21:03:31.554765	10	11.00	0.00	71.00
\.


--
-- TOC entry 5168 (class 0 OID 17193)
-- Dependencies: 233
-- Data for Name: rider_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_addresses (address_id, user_id, house_number, street, subdistrict, district, province, postal_code, is_default, created_at, updated_at) FROM stdin;
7	35	388	\N	เชียงเครือ	เมือง	สกล	\N	t	2025-09-19 12:40:32.191355	2025-09-19 12:40:32.191355
\.


--
-- TOC entry 5170 (class 0 OID 17202)
-- Dependencies: 235
-- Data for Name: rider_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_profiles (rider_id, user_id, id_card_number, id_card_photo_url, id_card_selfie_url, driving_license_number, driving_license_photo_url, vehicle_type, vehicle_brand_model, vehicle_color, vehicle_photo_url, vehicle_registration_photo_url, approval_status, approved_by, approved_at, rejection_reason, created_at, updated_at, vehicle_registration_number, vehicle_registration_province, promptpay, gp_balance, rating, reviews_count) FROM stdin;
9	37	1234567890123	https://res.cloudinary.com/djqdn2zru/image/upload/v1757955484/rider-documents/wxkj6qfku6ilpopwukj3.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1757955483/rider-documents/rwjhvrbng9v45gtaupgm.png	1234567890123	https://res.cloudinary.com/djqdn2zru/image/upload/v1757955486/rider-documents/bjapkagndovtj5ytqej6.png	motorcycle	wave110i	แดง	https://res.cloudinary.com/djqdn2zru/image/upload/v1757955488/rider-documents/figd27aahjjszsljctkl.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1757955489/rider-documents/eu2xkewmn0k7fg0u8bch.png	approved	1	\N	\N	2025-09-15 23:58:01.222327	2025-09-16 00:07:32.738618	1AB	สกลลนคร	\N	0.00	\N	0
10	35	9901700123459	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260702/rider-documents/ppufc7us313g6qem5zkp.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260701/rider-documents/hphwpjueczxwksykhlmr.png	DL1234568	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260703/rider-documents/n6ycoqgi3oz0wy3db1cj.png	motorcycle	Honda Wave	Red	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260704/rider-documents/qslldgochuknpxqns2hn.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260705/rider-documents/itjr5smgaraqqtadtlzb.png	approved	1	\N	\N	2025-09-19 12:44:59.694794	2025-09-23 09:55:38.43882	ฟก-123	สกลนคร	1234556789012	2170.00	0.0	0
\.


--
-- TOC entry 5183 (class 0 OID 17463)
-- Dependencies: 248
-- Data for Name: rider_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_reviews (review_id, order_id, user_id, rider_id, rating, comment, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5172 (class 0 OID 17217)
-- Dependencies: 237
-- Data for Name: rider_topups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_topups (topup_id, user_id, amount, slip_url, status, rejection_reason, admin_id, approved_at, created_at, updated_at, rider_id) FROM stdin;
6	35	70.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758353858/rider-topup-slips/bkxhe9kj96juhq1r0awr.png	approved	\N	1	2025-09-20 14:41:00.351283	2025-09-20 14:37:40.950213	2025-09-20 14:41:00.351283	10
7	35	2000.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758354121/rider-topup-slips/ydszj1lrbj6c7ytlaeiw.png	approved	\N	1	2025-09-20 14:42:26.851437	2025-09-20 14:42:03.258358	2025-09-20 14:42:26.851437	10
8	35	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758354174/rider-topup-slips/saw8oh6ix5tco7ywezb9.png	approved	\N	1	2025-09-20 14:43:05.86128	2025-09-20 14:42:56.310851	2025-09-20 14:43:05.86128	10
\.


--
-- TOC entry 5174 (class 0 OID 17227)
-- Dependencies: 239
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, google_id, display_name, email, password, birthdate, gender, phone, created_at, is_verified, photo_url, providers, is_seller, role, fcm_token) FROM stdin;
31	105392817902249087793	Taweechok KHAMPHUSA	taweechok.k@ku.th	\N	2003-07-06	0	0989520103	2025-09-10 14:42:48.63126	t	https://lh3.googleusercontent.com/a/ACg8ocLgf2QVH2faiqfFPK_Xm49JegXu7hTVP6EjlEZUj4a0Oy6KCF6W=s96-c	google	t	member	\N
32	101628051506191273987	Taweechok Khamphusa	aumt1569@gmail.com	\N	\N	\N	\N	2025-09-10 20:09:47.358897	f	https://lh3.googleusercontent.com/a/ACg8ocJw8scPixF2PrzJUUzpznN9BOXF94U_ylti8av5jpEvQ9CN4g=s96-c	google	f	member	\N
37	111829586382280768269	ทว๊โชค คําภูษา	aumtch1@gmail.com	\N	\N	\N	\N	2025-09-15 23:55:35.66864	f	https://lh3.googleusercontent.com/a/ACg8ocKCXxsaqiHPbfYCLLvj_drMtNJmISCAOJNo7hew6B0_k8IxKA=s96-c	google	f	rider	\N
36	\N	Name 	na@na.com	$2b$10$pkg9.0iqwmKp8m7jTpsFDuJlyxLCYqnbXjRg0GDL7xOvDNJpxkdK.	2000-01-16	0	0924287042	2025-09-19 18:04:08.192117	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1758281188/Market-LOGO/omheznsanssc2cjii6ww.jpg	manual	t	member	\N
35	\N	เย้ๆ123	test@example.com	$2b$10$tykFKP4xLP9Q5YRA2MXgOuQs/91k86YMUYOa5LsVsbd.nc0ugqEO6	1989-12-27	0	0895687260	2025-09-19 12:40:32.191355	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1758727167/rider-profiles/gtm79synxqid0d52wfq9.png	\N	t	rider	\N
34	118325243465533209842	ณัฐวุฒิ สุวรรณศรี	nuttass009@gmail.com	\N	2000-01-21	0	0203640923	2025-09-18 16:35:42.200299	t	https://lh3.googleusercontent.com/a/ACg8ocLfWHIvZ9WWZTZIFHtxYHNZ3WtrMGXqK2QakqUx--csINqEPQY=s96-c	google	t	member	\N
\.


--
-- TOC entry 5226 (class 0 OID 0)
-- Dependencies: 218
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 14, true);


--
-- TOC entry 5227 (class 0 OID 0)
-- Dependencies: 220
-- Name: carts_cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carts_cart_id_seq', 139, true);


--
-- TOC entry 5228 (class 0 OID 0)
-- Dependencies: 222
-- Name: categorys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorys_id_seq', 1, false);


--
-- TOC entry 5229 (class 0 OID 0)
-- Dependencies: 243
-- Name: chat_messages_message_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_messages_message_id_seq', 7, true);


--
-- TOC entry 5230 (class 0 OID 0)
-- Dependencies: 241
-- Name: chat_rooms_room_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_rooms_room_id_seq', 10, true);


--
-- TOC entry 5231 (class 0 OID 0)
-- Dependencies: 224
-- Name: client_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.client_addresses_id_seq', 13, true);


--
-- TOC entry 5232 (class 0 OID 0)
-- Dependencies: 226
-- Name: foods_food_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.foods_food_id_seq', 29, true);


--
-- TOC entry 5233 (class 0 OID 0)
-- Dependencies: 245
-- Name: market_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.market_reviews_review_id_seq', 10, true);


--
-- TOC entry 5234 (class 0 OID 0)
-- Dependencies: 228
-- Name: markets_market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.markets_market_id_seq', 43, true);


--
-- TOC entry 5235 (class 0 OID 0)
-- Dependencies: 230
-- Name: order_items_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_item_id_seq', 121, true);


--
-- TOC entry 5236 (class 0 OID 0)
-- Dependencies: 232
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 122, true);


--
-- TOC entry 5237 (class 0 OID 0)
-- Dependencies: 234
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_addresses_address_id_seq', 7, true);


--
-- TOC entry 5238 (class 0 OID 0)
-- Dependencies: 236
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_profiles_rider_id_seq', 10, true);


--
-- TOC entry 5239 (class 0 OID 0)
-- Dependencies: 247
-- Name: rider_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_reviews_review_id_seq', 10, true);


--
-- TOC entry 5240 (class 0 OID 0)
-- Dependencies: 238
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_topups_topup_id_seq', 8, true);


--
-- TOC entry 5241 (class 0 OID 0)
-- Dependencies: 240
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 39, true);


--
-- TOC entry 4899 (class 2606 OID 17250)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 4901 (class 2606 OID 17252)
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- TOC entry 4903 (class 2606 OID 17254)
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (cart_id);


--
-- TOC entry 4905 (class 2606 OID 17256)
-- Name: categorys categorys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys
    ADD CONSTRAINT categorys_pkey PRIMARY KEY (id);


--
-- TOC entry 4959 (class 2606 OID 17411)
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (message_id);


--
-- TOC entry 4952 (class 2606 OID 17381)
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (room_id);


--
-- TOC entry 4907 (class 2606 OID 17258)
-- Name: client_addresses client_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses
    ADD CONSTRAINT client_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 4909 (class 2606 OID 17260)
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (food_id);


--
-- TOC entry 4965 (class 2606 OID 17442)
-- Name: market_reviews market_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 4911 (class 2606 OID 17262)
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (market_id);


--
-- TOC entry 4914 (class 2606 OID 17264)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (item_id);


--
-- TOC entry 4918 (class 2606 OID 17266)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 4923 (class 2606 OID 17268)
-- Name: rider_addresses rider_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT rider_addresses_pkey PRIMARY KEY (address_id);


--
-- TOC entry 4932 (class 2606 OID 17270)
-- Name: rider_profiles rider_profiles_driving_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_driving_license_number_key UNIQUE (driving_license_number);


--
-- TOC entry 4934 (class 2606 OID 17272)
-- Name: rider_profiles rider_profiles_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_id_card_number_key UNIQUE (id_card_number);


--
-- TOC entry 4936 (class 2606 OID 17274)
-- Name: rider_profiles rider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_pkey PRIMARY KEY (rider_id);


--
-- TOC entry 4938 (class 2606 OID 17276)
-- Name: rider_profiles rider_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 4971 (class 2606 OID 17473)
-- Name: rider_reviews rider_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 4946 (class 2606 OID 17278)
-- Name: rider_topups rider_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_pkey PRIMARY KEY (topup_id);


--
-- TOC entry 4940 (class 2606 OID 17280)
-- Name: rider_profiles unique_vehicle_registration; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT unique_vehicle_registration UNIQUE (vehicle_registration_number, vehicle_registration_province);


--
-- TOC entry 4957 (class 2606 OID 17383)
-- Name: chat_rooms uq_chat_room_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT uq_chat_room_order UNIQUE (order_id);


--
-- TOC entry 4967 (class 2606 OID 17444)
-- Name: market_reviews uq_market_review_per_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT uq_market_review_per_order UNIQUE (order_id);


--
-- TOC entry 4973 (class 2606 OID 17475)
-- Name: rider_reviews uq_rider_review_per_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT uq_rider_review_per_order UNIQUE (order_id);


--
-- TOC entry 4948 (class 2606 OID 17282)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4950 (class 2606 OID 17284)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4960 (class 1259 OID 17426)
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);


--
-- TOC entry 4961 (class 1259 OID 17425)
-- Name: idx_chat_messages_room_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_room_id ON public.chat_messages USING btree (room_id);


--
-- TOC entry 4953 (class 1259 OID 17423)
-- Name: idx_chat_rooms_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_customer_id ON public.chat_rooms USING btree (customer_id);


--
-- TOC entry 4954 (class 1259 OID 17422)
-- Name: idx_chat_rooms_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_order_id ON public.chat_rooms USING btree (order_id);


--
-- TOC entry 4955 (class 1259 OID 17424)
-- Name: idx_chat_rooms_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_rider_id ON public.chat_rooms USING btree (rider_id);


--
-- TOC entry 4962 (class 1259 OID 17460)
-- Name: idx_market_reviews_market_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_reviews_market_id ON public.market_reviews USING btree (market_id);


--
-- TOC entry 4963 (class 1259 OID 17461)
-- Name: idx_market_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_reviews_user_id ON public.market_reviews USING btree (user_id);


--
-- TOC entry 4912 (class 1259 OID 17515)
-- Name: idx_order_items_original_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_original_price ON public.order_items USING btree (original_price);


--
-- TOC entry 4915 (class 1259 OID 17428)
-- Name: idx_orders_market_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_market_status_created ON public.orders USING btree (market_id, status, created_at);


--
-- TOC entry 4916 (class 1259 OID 17516)
-- Name: idx_orders_original_total_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_original_total_price ON public.orders USING btree (original_total_price);


--
-- TOC entry 4919 (class 1259 OID 17285)
-- Name: idx_rider_addresses_district; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_district ON public.rider_addresses USING btree (district, province);


--
-- TOC entry 4920 (class 1259 OID 17286)
-- Name: idx_rider_addresses_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_province ON public.rider_addresses USING btree (province);


--
-- TOC entry 4921 (class 1259 OID 17287)
-- Name: idx_rider_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_user_id ON public.rider_addresses USING btree (user_id);


--
-- TOC entry 4924 (class 1259 OID 17288)
-- Name: idx_rider_profiles_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_approval_status ON public.rider_profiles USING btree (approval_status);


--
-- TOC entry 4925 (class 1259 OID 17289)
-- Name: idx_rider_profiles_driving_license_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_driving_license_number ON public.rider_profiles USING btree (driving_license_number);


--
-- TOC entry 4926 (class 1259 OID 17290)
-- Name: idx_rider_profiles_id_card_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_id_card_number ON public.rider_profiles USING btree (id_card_number);


--
-- TOC entry 4927 (class 1259 OID 17291)
-- Name: idx_rider_profiles_promptpay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_promptpay ON public.rider_profiles USING btree (promptpay);


--
-- TOC entry 4928 (class 1259 OID 17292)
-- Name: idx_rider_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_user_id ON public.rider_profiles USING btree (user_id);


--
-- TOC entry 4929 (class 1259 OID 17293)
-- Name: idx_rider_profiles_vehicle_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles USING btree (vehicle_registration_province);


--
-- TOC entry 4930 (class 1259 OID 17294)
-- Name: idx_rider_profiles_vehicle_registration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles USING btree (vehicle_registration_number);


--
-- TOC entry 4968 (class 1259 OID 17491)
-- Name: idx_rider_reviews_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_reviews_rider_id ON public.rider_reviews USING btree (rider_id);


--
-- TOC entry 4969 (class 1259 OID 17492)
-- Name: idx_rider_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_reviews_user_id ON public.rider_reviews USING btree (user_id);


--
-- TOC entry 4941 (class 1259 OID 17295)
-- Name: idx_rider_topups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_created_at ON public.rider_topups USING btree (created_at);


--
-- TOC entry 4942 (class 1259 OID 17296)
-- Name: idx_rider_topups_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_rider_id ON public.rider_topups USING btree (rider_id);


--
-- TOC entry 4943 (class 1259 OID 17297)
-- Name: idx_rider_topups_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_status ON public.rider_topups USING btree (status);


--
-- TOC entry 4944 (class 1259 OID 17298)
-- Name: idx_rider_topups_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_user_id ON public.rider_topups USING btree (user_id);


--
-- TOC entry 5003 (class 2620 OID 17500)
-- Name: market_reviews trg_market_reviews_aiud; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_market_reviews_aiud AFTER INSERT OR DELETE OR UPDATE ON public.market_reviews FOR EACH ROW EXECUTE FUNCTION public._after_market_review_change();


--
-- TOC entry 5005 (class 2620 OID 17502)
-- Name: rider_reviews trg_rider_reviews_aiud; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_rider_reviews_aiud AFTER INSERT OR DELETE OR UPDATE ON public.rider_reviews FOR EACH ROW EXECUTE FUNCTION public._after_rider_review_change();


--
-- TOC entry 5004 (class 2620 OID 17494)
-- Name: market_reviews trg_validate_market_review; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_market_review BEFORE INSERT OR UPDATE ON public.market_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_market_review();


--
-- TOC entry 5006 (class 2620 OID 17496)
-- Name: rider_reviews trg_validate_rider_review; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_rider_review BEFORE INSERT OR UPDATE ON public.rider_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_rider_review();


--
-- TOC entry 5002 (class 2620 OID 17427)
-- Name: chat_rooms update_chat_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5000 (class 2620 OID 17299)
-- Name: rider_addresses update_rider_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_addresses_updated_at BEFORE UPDATE ON public.rider_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5001 (class 2620 OID 17300)
-- Name: rider_profiles update_rider_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4974 (class 2606 OID 17301)
-- Name: carts carts_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 4975 (class 2606 OID 17306)
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4992 (class 2606 OID 17412)
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE;


--
-- TOC entry 4993 (class 2606 OID 17417)
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4989 (class 2606 OID 17389)
-- Name: chat_rooms chat_rooms_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4990 (class 2606 OID 17384)
-- Name: chat_rooms chat_rooms_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4991 (class 2606 OID 17394)
-- Name: chat_rooms chat_rooms_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE CASCADE;


--
-- TOC entry 4981 (class 2606 OID 17503)
-- Name: orders fk_address; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_address FOREIGN KEY (address_id) REFERENCES public.client_addresses(id);


--
-- TOC entry 4977 (class 2606 OID 17311)
-- Name: markets fk_admin; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 4983 (class 2606 OID 17316)
-- Name: rider_addresses fk_rider_addresses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT fk_rider_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4984 (class 2606 OID 17321)
-- Name: rider_profiles fk_rider_profiles_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES public.admins(id);


--
-- TOC entry 4985 (class 2606 OID 17326)
-- Name: rider_profiles fk_rider_profiles_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4976 (class 2606 OID 17331)
-- Name: foods foods_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 4994 (class 2606 OID 17455)
-- Name: market_reviews market_reviews_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 4995 (class 2606 OID 17445)
-- Name: market_reviews market_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4996 (class 2606 OID 17450)
-- Name: market_reviews market_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4978 (class 2606 OID 17336)
-- Name: markets markets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


--
-- TOC entry 4979 (class 2606 OID 17341)
-- Name: order_items order_items_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id);


--
-- TOC entry 4980 (class 2606 OID 17346)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4982 (class 2606 OID 17351)
-- Name: orders orders_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id);


--
-- TOC entry 4997 (class 2606 OID 17476)
-- Name: rider_reviews rider_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4998 (class 2606 OID 17486)
-- Name: rider_reviews rider_reviews_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE CASCADE;


--
-- TOC entry 4999 (class 2606 OID 17481)
-- Name: rider_reviews rider_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4986 (class 2606 OID 17356)
-- Name: rider_topups rider_topups_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 4987 (class 2606 OID 17361)
-- Name: rider_topups rider_topups_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id);


--
-- TOC entry 4988 (class 2606 OID 17366)
-- Name: rider_topups rider_topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


-- Completed on 2025-09-27 23:42:41

--
-- PostgreSQL database dump complete
--

