--
-- PostgreSQL database dump
--

\restrict 7i9jmpqvS2vDqfZaw67yXpkpuAqdxcdL7URBq4RsvmYoB1yCHVq9LQH5E8YLN85

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg13+1)
-- Dumped by pg_dump version 16.10

-- Started on 2025-10-17 09:47:47 +07

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
-- TOC entry 253 (class 1255 OID 16385)
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
-- TOC entry 254 (class 1255 OID 16386)
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
-- TOC entry 255 (class 1255 OID 16387)
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
-- TOC entry 256 (class 1255 OID 16388)
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
-- TOC entry 257 (class 1255 OID 16389)
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
-- TOC entry 258 (class 1255 OID 16390)
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
-- TOC entry 259 (class 1255 OID 16391)
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
-- TOC entry 260 (class 1255 OID 16392)
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
-- TOC entry 215 (class 1259 OID 16393)
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
-- TOC entry 216 (class 1259 OID 16399)
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
-- TOC entry 3774 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 217 (class 1259 OID 16400)
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
-- TOC entry 218 (class 1259 OID 16407)
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
-- TOC entry 3775 (class 0 OID 0)
-- Dependencies: 218
-- Name: carts_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carts_cart_id_seq OWNED BY public.carts.cart_id;


--
-- TOC entry 219 (class 1259 OID 16408)
-- Name: categorys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorys (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    cate_image_url text
);


ALTER TABLE public.categorys OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16413)
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
-- TOC entry 3776 (class 0 OID 0)
-- Dependencies: 220
-- Name: categorys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorys_id_seq OWNED BY public.categorys.id;


--
-- TOC entry 221 (class 1259 OID 16414)
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
    CONSTRAINT chk_sender_type CHECK (((sender_type)::text = ANY (ARRAY[('customer'::character varying)::text, ('rider'::character varying)::text, ('admin'::character varying)::text, ('member'::character varying)::text])))
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16423)
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
-- TOC entry 3777 (class 0 OID 0)
-- Dependencies: 222
-- Name: chat_messages_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_message_id_seq OWNED BY public.chat_messages.message_id;


--
-- TOC entry 223 (class 1259 OID 16424)
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
-- TOC entry 224 (class 1259 OID 16430)
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
-- TOC entry 3778 (class 0 OID 0)
-- Dependencies: 224
-- Name: chat_rooms_room_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_rooms_room_id_seq OWNED BY public.chat_rooms.room_id;


--
-- TOC entry 225 (class 1259 OID 16431)
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
-- TOC entry 226 (class 1259 OID 16437)
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
-- TOC entry 3779 (class 0 OID 0)
-- Dependencies: 226
-- Name: client_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_addresses_id_seq OWNED BY public.client_addresses.id;


--
-- TOC entry 227 (class 1259 OID 16438)
-- Name: complaints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.complaints (
    complaint_id integer NOT NULL,
    user_id integer,
    rider_id integer,
    market_id integer,
    role text,
    subject text NOT NULL,
    message text NOT NULL,
    evidence_url text,
    created_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'pending'::character varying,
    updated_at timestamp without time zone,
    CONSTRAINT complaints_role_check CHECK ((role = ANY (ARRAY['member'::text, 'rider'::text, 'market'::text, 'admin'::text, 'customer'::text])))
);


ALTER TABLE public.complaints OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16446)
-- Name: complaints_complaint_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.complaints_complaint_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.complaints_complaint_id_seq OWNER TO postgres;

--
-- TOC entry 3780 (class 0 OID 0)
-- Dependencies: 228
-- Name: complaints_complaint_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.complaints_complaint_id_seq OWNED BY public.complaints.complaint_id;


--
-- TOC entry 229 (class 1259 OID 16447)
-- Name: food_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.food_reviews (
    review_id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    market_id integer NOT NULL,
    food_id integer NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    order_item_id integer,
    CONSTRAINT food_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.food_reviews OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16455)
-- Name: food_reviews_review_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.food_reviews_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.food_reviews_review_id_seq OWNER TO postgres;

--
-- TOC entry 3781 (class 0 OID 0)
-- Dependencies: 230
-- Name: food_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.food_reviews_review_id_seq OWNED BY public.food_reviews.review_id;


--
-- TOC entry 231 (class 1259 OID 16456)
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
    sell_options jsonb DEFAULT '[]'::jsonb,
    category_id integer,
    created_by_admin_id integer,
    is_visible boolean DEFAULT true
);


ALTER TABLE public.foods OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16465)
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
-- TOC entry 3782 (class 0 OID 0)
-- Dependencies: 232
-- Name: foods_food_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.foods_food_id_seq OWNED BY public.foods.food_id;


--
-- TOC entry 233 (class 1259 OID 16466)
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
-- TOC entry 234 (class 1259 OID 16474)
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
-- TOC entry 3783 (class 0 OID 0)
-- Dependencies: 234
-- Name: market_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.market_reviews_review_id_seq OWNED BY public.market_reviews.review_id;


--
-- TOC entry 235 (class 1259 OID 16475)
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
-- TOC entry 236 (class 1259 OID 16486)
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
-- TOC entry 3784 (class 0 OID 0)
-- Dependencies: 236
-- Name: markets_market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.markets_market_id_seq OWNED BY public.markets.market_id;


--
-- TOC entry 237 (class 1259 OID 16487)
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
    original_options jsonb DEFAULT '[]'::jsonb,
    additional_notes text DEFAULT ''::text,
    is_reviewed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- TOC entry 3785 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN order_items.original_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_price IS 'ราคาต้นทุนก่อนบวก%เพิ่ม';


--
-- TOC entry 3786 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN order_items.original_subtotal; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_subtotal IS 'ราคารวมต้นทุนก่อนบวก%เพิ่ม (original_price * quantity)';


--
-- TOC entry 3787 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN order_items.original_options; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_options IS 'ตัวเลือกอาหารราคาต้นทุนก่อนบวก%เพิ่ม';


--
-- TOC entry 3788 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN order_items.additional_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.additional_notes IS 'รายละเอียดเพิ่มเติมของแต่ละเมนู เช่น ไม่ใส่ผักชี, เผ็ดน้อย, ไม่ใส่น้ำแข็ง';


--
-- TOC entry 238 (class 1259 OID 16498)
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
-- TOC entry 3789 (class 0 OID 0)
-- Dependencies: 238
-- Name: order_items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_item_id_seq OWNED BY public.order_items.item_id;


--
-- TOC entry 239 (class 1259 OID 16499)
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
    original_total_price numeric(10,2) DEFAULT 0.00,
    shop_status character varying(30),
    delivery_photo text,
    is_market_reviewed boolean DEFAULT false,
    is_rider_reviewed boolean DEFAULT false,
    CONSTRAINT chk_orders_shop_status CHECK (((shop_status IS NULL) OR ((shop_status)::text = ANY (ARRAY[('preparing'::character varying)::text, ('ready_for_pickup'::character varying)::text]))))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 3790 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN orders.original_total_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.original_total_price IS 'ราคารวมต้นทุนก่อนบวก%เพิ่ม (ไม่รวมค่าส่ง)';


--
-- TOC entry 240 (class 1259 OID 16513)
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
-- TOC entry 3791 (class 0 OID 0)
-- Dependencies: 240
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- TOC entry 241 (class 1259 OID 16514)
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
-- TOC entry 3792 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE rider_addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_addresses IS 'ตารางเก็บที่อยู่ของไรเดอร์';


--
-- TOC entry 3793 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN rider_addresses.subdistrict; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.subdistrict IS 'ตำบล';


--
-- TOC entry 3794 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN rider_addresses.district; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.district IS 'อำเภอ';


--
-- TOC entry 3795 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN rider_addresses.province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.province IS 'จังหวัด';


--
-- TOC entry 242 (class 1259 OID 16522)
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
-- TOC entry 3796 (class 0 OID 0)
-- Dependencies: 242
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_addresses_address_id_seq OWNED BY public.rider_addresses.address_id;


--
-- TOC entry 243 (class 1259 OID 16523)
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
-- TOC entry 3797 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE rider_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_profiles IS 'ตารางเก็บข้อมูลไรเดอร์ที่ต้องการยืนยันตัวตน';


--
-- TOC entry 3798 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.id_card_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_photo_url IS 'รูปถ่ายบัตรประชาชน';


--
-- TOC entry 3799 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.id_card_selfie_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_selfie_url IS 'รูปถ่ายคู่บัตรประชาชน';


--
-- TOC entry 3800 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.driving_license_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.driving_license_photo_url IS 'รูปใบขับขี่';


--
-- TOC entry 3801 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.vehicle_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_type IS 'ประเภทรถ (ปัจจุบันรองรับแค่ motorcycle)';


--
-- TOC entry 3802 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.vehicle_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_photo_url IS 'รูปถ่ายรถ';


--
-- TOC entry 3803 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.vehicle_registration_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_photo_url IS 'รูปคู่มือทะเบียนรถ';


--
-- TOC entry 3804 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.vehicle_registration_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';


--
-- TOC entry 3805 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.vehicle_registration_province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';


--
-- TOC entry 3806 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_profiles.promptpay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.promptpay IS 'หมายเลข PromptPay (เบอร์โทร 10 หลักหรือเลขบัตรประชาชน 13 หลัก)';


--
-- TOC entry 244 (class 1259 OID 16538)
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
-- TOC entry 3807 (class 0 OID 0)
-- Dependencies: 244
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_profiles_rider_id_seq OWNED BY public.rider_profiles.rider_id;


--
-- TOC entry 245 (class 1259 OID 16539)
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
-- TOC entry 246 (class 1259 OID 16547)
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
-- TOC entry 3808 (class 0 OID 0)
-- Dependencies: 246
-- Name: rider_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_reviews_review_id_seq OWNED BY public.rider_reviews.review_id;


--
-- TOC entry 247 (class 1259 OID 16548)
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
    CONSTRAINT rider_topups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'refunded'::text])))
);


ALTER TABLE public.rider_topups OWNER TO postgres;

--
-- TOC entry 3809 (class 0 OID 0)
-- Dependencies: 247
-- Name: TABLE rider_topups; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_topups IS 'ตารางเก็บข้อมูลการเติมเงิน GP ของไรเดอร์';


--
-- TOC entry 3810 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN rider_topups.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.user_id IS 'รหัสผู้ใช้ที่เป็นไรเดอร์ (อ้างอิงจาก users table)';


--
-- TOC entry 3811 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN rider_topups.rider_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.rider_id IS 'รหัสไรเดอร์ (อ้างอิงจาก rider_profiles table)';


--
-- TOC entry 248 (class 1259 OID 16557)
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
-- TOC entry 3812 (class 0 OID 0)
-- Dependencies: 248
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_topups_topup_id_seq OWNED BY public.rider_topups.topup_id;


--
-- TOC entry 249 (class 1259 OID 16558)
-- Name: shop_closed_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shop_closed_reports (
    report_id integer NOT NULL,
    order_id integer,
    market_id integer,
    rider_id integer,
    reason text NOT NULL,
    note text,
    image_urls text[],
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT shop_closed_reports_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('checked'::character varying)::text])))
);


ALTER TABLE public.shop_closed_reports OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 16567)
-- Name: shop_closed_reports_report_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shop_closed_reports_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shop_closed_reports_report_id_seq OWNER TO postgres;

--
-- TOC entry 3813 (class 0 OID 0)
-- Dependencies: 250
-- Name: shop_closed_reports_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shop_closed_reports_report_id_seq OWNED BY public.shop_closed_reports.report_id;


--
-- TOC entry 251 (class 1259 OID 16568)
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
-- TOC entry 252 (class 1259 OID 16577)
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
-- TOC entry 3814 (class 0 OID 0)
-- Dependencies: 252
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 3365 (class 2604 OID 16578)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 3367 (class 2604 OID 16579)
-- Name: carts cart_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts ALTER COLUMN cart_id SET DEFAULT nextval('public.carts_cart_id_seq'::regclass);


--
-- TOC entry 3370 (class 2604 OID 16580)
-- Name: categorys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys ALTER COLUMN id SET DEFAULT nextval('public.categorys_id_seq'::regclass);


--
-- TOC entry 3371 (class 2604 OID 16581)
-- Name: chat_messages message_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN message_id SET DEFAULT nextval('public.chat_messages_message_id_seq'::regclass);


--
-- TOC entry 3375 (class 2604 OID 16582)
-- Name: chat_rooms room_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms ALTER COLUMN room_id SET DEFAULT nextval('public.chat_rooms_room_id_seq'::regclass);


--
-- TOC entry 3379 (class 2604 OID 16583)
-- Name: client_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses ALTER COLUMN id SET DEFAULT nextval('public.client_addresses_id_seq'::regclass);


--
-- TOC entry 3381 (class 2604 OID 16584)
-- Name: complaints complaint_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints ALTER COLUMN complaint_id SET DEFAULT nextval('public.complaints_complaint_id_seq'::regclass);


--
-- TOC entry 3384 (class 2604 OID 16585)
-- Name: food_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.food_reviews_review_id_seq'::regclass);


--
-- TOC entry 3387 (class 2604 OID 16586)
-- Name: foods food_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods ALTER COLUMN food_id SET DEFAULT nextval('public.foods_food_id_seq'::regclass);


--
-- TOC entry 3392 (class 2604 OID 16587)
-- Name: market_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.market_reviews_review_id_seq'::regclass);


--
-- TOC entry 3395 (class 2604 OID 16588)
-- Name: markets market_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets ALTER COLUMN market_id SET DEFAULT nextval('public.markets_market_id_seq'::regclass);


--
-- TOC entry 3402 (class 2604 OID 16589)
-- Name: order_items item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN item_id SET DEFAULT nextval('public.order_items_item_id_seq'::regclass);


--
-- TOC entry 3409 (class 2604 OID 16590)
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- TOC entry 3418 (class 2604 OID 16591)
-- Name: rider_addresses address_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses ALTER COLUMN address_id SET DEFAULT nextval('public.rider_addresses_address_id_seq'::regclass);


--
-- TOC entry 3422 (class 2604 OID 16592)
-- Name: rider_profiles rider_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles ALTER COLUMN rider_id SET DEFAULT nextval('public.rider_profiles_rider_id_seq'::regclass);


--
-- TOC entry 3431 (class 2604 OID 16593)
-- Name: rider_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.rider_reviews_review_id_seq'::regclass);


--
-- TOC entry 3434 (class 2604 OID 16594)
-- Name: rider_topups topup_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups ALTER COLUMN topup_id SET DEFAULT nextval('public.rider_topups_topup_id_seq'::regclass);


--
-- TOC entry 3438 (class 2604 OID 16595)
-- Name: shop_closed_reports report_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports ALTER COLUMN report_id SET DEFAULT nextval('public.shop_closed_reports_report_id_seq'::regclass);


--
-- TOC entry 3442 (class 2604 OID 16596)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 3731 (class 0 OID 16393)
-- Dependencies: 215
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admins (id, username, password, role) FROM stdin;
6	ADMIN3	$2b$10$uuGLbfeLB7vkuPnG0/MzfuvXWl9cMIUOrDItQJS9fc0TgrT3E7GlK	user
8	ADMIN_H	$2b$10$xQ.DeJ7wwqP71A1zcIlOkO7wnRmirrymrk8R6lKdYAtIQh2qCLeba	user
4	ADMIN1	$2b$10$tsziOAy2pKtbP4Avi9fT5ert6U0DBWyVFPO7Uzg/gRljjtpBPEEyy	admin
5	ADMIN2	$2b$10$VgIPiz20GX8u4H7RoUeMAO16051AA.aTgsrlIk7GFBd9QtC4P8SFG	user
14	ADMIN4	$2b$10$EQNCltU5vtj4LwwWEqGluObDC3sloblkmqcuWqDbkMtgrP5Mob7QO	user
15	ADMINADMIN	$2b$10$pW8Hm7TpZhx8JQgwYlYFUulLNCJ1udGvb8zy4lKbI3ZKTZKLTmprC	admin
13	H_ADMIN	$2b$10$SZ8AbWTpLBG4.tFXrizBBuECMiEpb7QCjP18slH6NrdFQVLLkzY/i	admin
1	M_ADMIN	$2b$10$DcqigpmUwgCk5LozimgKT.PbhcNwfLqYJeaeIDnH1Be6zhZeeh7fS	m_admin
\.


--
-- TOC entry 3733 (class 0 OID 16400)
-- Dependencies: 217
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carts (cart_id, user_id, food_id, quantity, selected_options, note, total, created_at) FROM stdin;
\.


--
-- TOC entry 3735 (class 0 OID 16408)
-- Dependencies: 219
-- Data for Name: categorys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorys (id, name, cate_image_url) FROM stdin;
9	อาหารตามสั่ง	https://res.cloudinary.com/djqdn2zru/image/upload/v1760656908/food-menu/qzrkwzo0j7qabmkbsfoa.jpg
10	เครื่องดื่ม	https://res.cloudinary.com/djqdn2zru/image/upload/v1760657148/food-menu/vjoujp3jsig2ehovzopr.png
11	ก๋วยเตี๋ยว	https://res.cloudinary.com/djqdn2zru/image/upload/v1760657192/food-menu/ujlxcipln4v2rboivcsw.jpg
12	อาหารอีสาน	https://res.cloudinary.com/djqdn2zru/image/upload/v1760657253/food-menu/apyj0wm1orw3vuopuogg.jpg
13	ของกินเล่น	https://res.cloudinary.com/djqdn2zru/image/upload/v1760657359/food-menu/d5sawluudaefj8hfwv9q.jpg
14	ผลไม้	https://res.cloudinary.com/djqdn2zru/image/upload/v1760657406/food-menu/v2drv7mz4whgxs7cciuf.jpg
15	ของหวาน	https://res.cloudinary.com/djqdn2zru/image/upload/v1760657475/food-menu/bcki0nauphebmv9mdqnd.jpg
\.


--
-- TOC entry 3737 (class 0 OID 16414)
-- Dependencies: 221
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (message_id, room_id, sender_id, sender_type, message_text, message_type, image_url, latitude, longitude, is_read, created_at) FROM stdin;
\.


--
-- TOC entry 3739 (class 0 OID 16424)
-- Dependencies: 223
-- Data for Name: chat_rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_rooms (room_id, order_id, customer_id, rider_id, status, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3741 (class 0 OID 16431)
-- Dependencies: 225
-- Data for Name: client_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_addresses (id, user_id, name, phone, address, district, city, postal_code, notes, latitude, longitude, location_text, created_at, set_address) FROM stdin;
4	32	สุดจะทน	0879465312	74HJ+7JG 74HJ+7JG ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.2781712	104.1316336	74HJ+7JG 74HJ+7JG ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:04:29.922383	f
5	32	กับคนอย่างเธอ	0852134679	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.2863889	104.1127778	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:05:32.232987	f
6	32	อาร์ม	0986123547	74JC+6RC Unnamed Rd อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000	ตึก B	17.2805649	104.1220182	74JC+6RC Unnamed Rd อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:06:42.914712	t
10	36	มาเฟีย	0924387042	Bokpyin ต.Bokpyin อ.Kawthoung จ.Tanintharyi Region	Kawthoung	Tanintharyi Region	49000	อะไรหรอ	17.189523	104.089977	อาคารศาลากลางจังหวัดสกลนคร 2507 ตำบลธาตุเชิงชุม อำเภออำเภอเมืองสกลนคร จังหวัดสกลนคร รหัสไปรษณีย์ 47000. ประเภทแหล่งศิลปกรรมฯ.	2025-09-19 18:09:27.014042	t
9	34	1	s	80101 Agate จ.Colorado 80101	s	Colorado	80101		39.378044746158864	-104.16305501013994	80101 Agate จ.Colorado 80101	2025-09-19 17:44:13.568528	t
13	35	มาเล่น	0871676488	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	อำเภออินทร์บุรี	สิงห์บุรี	16110		15.072804051207106	100.35490293055773	ถนนที่ไม่มีชื่อ ถนนที่ไม่มีชื่อ ตำบล ชีน้ำร้าย อำเภออินทร์บุรี สิงห์บุรี 16110 ประเทศไทย อ.อำเภออินทร์บุรี จ.สิงห์บุรี 16110	2025-09-26 15:46:42.141682	t
2	31	สุดหล่อจ่ะ	0989520103	74Q9+GCW อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.28956803546931	104.11867182701826	74Q9+GCW อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-13 16:30:15.754407	f
3	31	เสก สุดจะหล่อ	0987654321	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.286741935703482	104.11390386521816	อ่างสกลนคร 74P7+M25 อ่างสกลนคร ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-13 18:03:41.179373	f
7	31	สุดจัด	0849567312	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.26881945839936	104.13779195398092	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:13:49.04298	f
8	31	เฟียส	0982147653	74CG+G37 74CG+G37 ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000	หน้าร้าน ขายของชำ	17.271748923950433	104.12641134113073	74CG+G37 74CG+G37 ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:17:19.27141	t
\.


--
-- TOC entry 3743 (class 0 OID 16438)
-- Dependencies: 227
-- Data for Name: complaints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.complaints (complaint_id, user_id, rider_id, market_id, role, subject, message, evidence_url, created_at, status, updated_at) FROM stdin;
3	35	10	\N	rider	asd	abc	/uploads/complaints/complaint-1760345872853-292.jpeg	2025-10-13 15:57:52.878412	checked	2025-10-14 21:52:27.172953
2	35	10	\N	rider	asd	abc	\N	2025-10-13 15:52:07.321064	checked	2025-10-14 21:55:57.549323
\.


--
-- TOC entry 3745 (class 0 OID 16447)
-- Dependencies: 229
-- Data for Name: food_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.food_reviews (review_id, order_id, user_id, market_id, food_id, rating, comment, created_at, updated_at, order_item_id) FROM stdin;
\.


--
-- TOC entry 3747 (class 0 OID 16456)
-- Dependencies: 231
-- Data for Name: foods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.foods (food_id, market_id, food_name, price, image_url, created_at, options, rating, sell_price, sell_options, category_id, created_by_admin_id, is_visible) FROM stdin;
43	44	กระเพรา	39.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760658114/food-menu/mthwxryeawow3jgrfwpw.jpg	2025-10-17 06:41:54.890425	[{"label": "หมูชิ้น", "extraPrice": 0}, {"label": "หมูสับ", "extraPrice": 0}, {"label": "หมูสามชั้น", "extraPrice": 0}, {"label": "เนื้อไก่", "extraPrice": 0}]	\N	47.00	[{"label": "หมูชิ้น", "extraPrice": 0}, {"label": "หมูสับ", "extraPrice": 0}, {"label": "หมูสามชั้น", "extraPrice": 0}, {"label": "เนื้อไก่", "extraPrice": 0}]	9	1	t
44	44	ไข่เจียว	29.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760658273/food-menu/nw0ysgze7zk6hsnfz5se.jpg	2025-10-17 06:44:33.840186	[{"label": "ปูอัด", "extraPrice": 6}, {"label": "หมูสับ", "extraPrice": 6}, {"label": "ไส้กรอก", "extraPrice": 6}, {"label": "แหนม", "extraPrice": 11}, {"label": "ไก่ยอ", "extraPrice": 6}, {"label": "กุนเชียง", "extraPrice": 6}]	\N	35.00	[{"label": "ปูอัด", "extraPrice": 8}, {"label": "หมูสับ", "extraPrice": 8}, {"label": "ไส้กรอก", "extraPrice": 8}, {"label": "แหนม", "extraPrice": 14}, {"label": "ไก่ยอ", "extraPrice": 8}, {"label": "กุนเชียง", "extraPrice": 8}]	9	1	t
45	44	ไข่ดาว	29.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760658328/food-menu/ve7gbwfpvxgqvec0wr4n.jpg	2025-10-17 06:45:28.740974	[]	\N	35.00	[]	9	1	t
46	45	หมูปิ้ง	5.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760658744/food-menu/jhbskv8fxy69chbinbn5.jpg	2025-10-17 06:52:24.856902	[]	\N	6.00	[]	13	1	t
47	45	ข้าวเหนียว	10.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760658773/food-menu/sdji9xij2zk0ats3lyi2.jpg	2025-10-17 06:52:53.708214	[]	\N	12.00	[]	12	1	t
48	38	ข้าวผัด	40.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760659051/food-menu/sk94ws4hejqvro1fp8ot.jpg	2025-10-17 06:57:32.393593	[]	\N	48.00	[]	9	1	t
49	39	กล้วยบวชชี	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760659812/Market-LOGO/i4tsqltffnbomjvuj3xr.png	2025-10-17 07:08:58.438784	[]	\N	23.00	[]	15	\N	t
50	39	บัวลอยไข่หวาน	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760659893/Market-LOGO/x0dcrizhm0panqy2vjbn.png	2025-10-17 07:11:33.753911	[]	\N	23.00	[]	15	\N	t
51	39	ทับทิมกรอบน้ำกะทิ	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760660022/Market-LOGO/ggdg8rfdpwl2qday2wcz.png	2025-10-17 07:13:43.228665	[]	\N	23.00	[]	15	\N	t
52	46	คอหมูย่าง	50.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760661350/Market-LOGO/zulwrf1id7na4t7hyugr.jpg	2025-10-17 07:35:51.036099	[]	\N	58.00	[]	12	\N	t
53	46	ไก่ย่างสูตรพี่เสก	60.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760661435/Market-LOGO/aadltq2j4flxidqob31v.jpg	2025-10-17 07:37:17.042001	[]	\N	69.00	[]	12	\N	t
54	46	จระเข้หันทั้งตัว	1000.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760661635/Market-LOGO/h6awzgcoa66boigb0ar5.jpg	2025-10-17 07:40:35.903164	[]	\N	1150.00	[]	12	\N	t
55	46	ปลาเผาน้ำจิ้มแจ่ว	70.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760661761/Market-LOGO/hkncfxemzi6wvmrxckrq.jpg	2025-10-17 07:42:42.302366	[{"label": "ชุดใหญ่", "extraPrice": 30}, {"label": "แจ่วสูตรอ้ายเสก", "extraPrice": 0}, {"label": "แจ่วขม", "extraPrice": 0}, {"label": "แจ่วแซ่บ", "extraPrice": 0}]	\N	81.00	[{"label": "ชุดใหญ่", "extraPrice": 35}, {"label": "แจ่วสูตรอ้ายเสก", "extraPrice": 0}, {"label": "แจ่วขม", "extraPrice": 0}, {"label": "แจ่วแซ่บ", "extraPrice": 0}]	12	\N	t
56	46	หมึกย่างเสียบไม้	10.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760661902/Market-LOGO/ecrwxk6eflu5bcf8u6rx.jpg	2025-10-17 07:45:02.994833	[{"label": "น้ำจิ้มซีฟู้ด", "extraPrice": 0}, {"label": "น้ำจิ้มมะขามเปียก", "extraPrice": 0}, {"label": "ไม่เผ็ด", "extraPrice": 0}, {"label": "เผ็ดมากๆ", "extraPrice": 0}]	\N	12.00	[{"label": "น้ำจิ้มซีฟู้ด", "extraPrice": 0}, {"label": "น้ำจิ้มมะขามเปียก", "extraPrice": 0}, {"label": "ไม่เผ็ด", "extraPrice": 0}, {"label": "เผ็ดมากๆ", "extraPrice": 0}]	13	\N	t
57	47	ฝรั่งดอง	10.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760662460/Market-LOGO/m9l2968zanxpkknvfzyv.jpg	2025-10-17 07:54:20.875243	[]	\N	12.00	[]	14	\N	t
58	47	แตงโม	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760662511/Market-LOGO/w8rppdptgpw9dwqiyow4.jpg	2025-10-17 07:55:11.577933	[]	\N	23.00	[]	14	\N	t
59	47	ลำไย	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760662565/Market-LOGO/zk2fqdecm8aolxe0ldrq.jpg	2025-10-17 07:56:06.54741	[]	\N	23.00	[]	14	\N	t
60	47	สับปะรด	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760662673/Market-LOGO/k6l8ahjedyppbh0zvz7t.png	2025-10-17 07:57:54.231832	[]	\N	23.00	[]	14	\N	t
61	48	ชาไทยเย็น	50.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760663251/food-menu/a2ikfs4p5shcjct2b6lk.jpg	2025-10-17 08:07:32.388773	[{"label": "เพิ่มนม", "extraPrice": 5}]	\N	60.00	[{"label": "เพิ่มนม", "extraPrice": 6}]	10	1	t
62	48	มัทฉะมะพร้าว	65.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760663329/food-menu/yrqlf6nqfu6t4xnqcda0.jpg	2025-10-17 08:08:49.81744	[]	\N	78.00	[]	10	1	t
63	49	ก๋วยเตี๋ยวเย็นตาโฟ	40.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760663737/food-menu/ffnmklwvwo81lt7ztqlr.jpg	2025-10-17 08:15:38.033474	[{"label": "เส้นเล็ก", "extraPrice": 0}, {"label": "เส้นมาม่า", "extraPrice": 0}, {"label": "เส้นหมี่เหลือง", "extraPrice": 0}, {"label": "น้ำตก", "extraPrice": 0}, {"label": "น้ำใส", "extraPrice": 0}]	\N	48.00	[{"label": "เส้นเล็ก", "extraPrice": 0}, {"label": "เส้นมาม่า", "extraPrice": 0}, {"label": "เส้นหมี่เหลือง", "extraPrice": 0}, {"label": "น้ำตก", "extraPrice": 0}, {"label": "น้ำใส", "extraPrice": 0}]	11	1	t
64	49	ก๋วยเตี๋ยวเนื้อเปื่อย	40.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760663983/food-menu/bxssykeldbwcugohdwwd.jpg	2025-10-17 08:19:43.720844	[{"label": "เส้นเล็ก", "extraPrice": 0}, {"label": "วุ้นเส้น", "extraPrice": 0}, {"label": "มาม่า", "extraPrice": 0}, {"label": "น้ำตก", "extraPrice": 0}, {"label": "น้ำใส", "extraPrice": 0}]	\N	48.00	[{"label": "เส้นเล็ก", "extraPrice": 0}, {"label": "วุ้นเส้น", "extraPrice": 0}, {"label": "มาม่า", "extraPrice": 0}, {"label": "น้ำตก", "extraPrice": 0}, {"label": "น้ำใส", "extraPrice": 0}]	11	1	t
\.


--
-- TOC entry 3749 (class 0 OID 16466)
-- Dependencies: 233
-- Data for Name: market_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.market_reviews (review_id, order_id, user_id, market_id, rating, comment, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3751 (class 0 OID 16475)
-- Dependencies: 235
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.markets (market_id, owner_id, shop_name, shop_description, shop_logo_url, created_at, latitude, longitude, open_time, close_time, is_open, is_manual_override, override_until, rating, address, phone, approve, admin_id, is_admin, reviews_count) FROM stdin;
49	\N	เตี๋ยวเรือปัณณพร	ขายก๋วยเตี๋ยว	https://res.cloudinary.com/djqdn2zru/image/upload/v1760663662/food-menu/sa2xmesydbl9sspkgfpb.jpg	2025-10-17 08:13:59.119096	17.2812439	104.12021659999999	08:13	22:20	t	f	\N	\N	74JC+F3W, Unnamed Rd, Tambon Chiang Khruea, Amphoe Mueang Sakon Nakhon, Chang Wat Sakon Nakhon 47000, Thailand	099999999999	f	1	t	0
45	\N	พุงโลหมูปิ้ง	ขายหมูปิ้งแซ่บๆ	https://res.cloudinary.com/djqdn2zru/image/upload/v1760658609/food-menu/tvrmk3wsdzydo7cxr1gv.jpg	2025-10-05 23:40:41.440782	17.28602753616214	104.11513813043838	06:10	16:41	t	f	\N	\N		0919463256	f	15	t	0
48	\N	Aree cafe & workspace 	ขายเครื่องดื่ม กาแฟ ขนมหวาน	https://res.cloudinary.com/djqdn2zru/image/upload/v1760663107/food-menu/k221p1rwooailtedekve.jpg	2025-10-17 08:04:34.914688	17.265102	104.13390989999999	09:00	19:04	t	f	\N	\N	ชาลี อพาร์ทเม้นท์ 513 ม.1, Tambon Chiang Khruea, เมือง Chang Wat Sakon Nakhon 47000, Thailand	0933843575	f	1	t	0
44	\N	ซิมเบิ่งเด้อ	ขายอาการตามสั่ง เปิด 18:00 - 05:00 น. อร่อยพร้อมส่ง	https://res.cloudinary.com/djqdn2zru/image/upload/v1760657892/food-menu/eetdfxhx0nvt6zybswrb.jpg	2025-10-04 21:04:05.394236	17.272637211868073	104.13484127931125	11:00	03:00	f	f	\N	0.0	123/9 บ้านเชียงเครือ เชียงเครือ เมือง สกลนคร 47000	0951361517	f	1	t	0
46	46	ร้านอ้ายเสก(สายย่าง)	ขายเนื้อปิ้งย่างทุกเนื้อที่ปิ้งได้	https://res.cloudinary.com/djqdn2zru/image/upload/v1760661131/Market-LOGO/mdr7d2nb5kxqf8bjxplw.jpg	2025-10-17 07:32:12.295026	17.280726	104.1220469	09:30	23:40	t	t	\N	\N	หอเชรวรี หอชายตึกA	0933333333333	t	\N	f	0
39	36	ร้านน้องหวาน	ร้านขายของหวาน	https://res.cloudinary.com/djqdn2zru/image/upload/v1760659311/Market-LOGO/vkub02oygequ7u0dlyz0.jpg	2025-09-19 18:29:17.243767	17.27891775402024	104.11517959088087	15:54	19:54	t	t	\N	\N	42/6 เชียงเครือ หออะตอม 45801a	0716876464	t	1	f	2
38	\N	ร้านแอดมิน	ร้านแอดมิน เด้อจ่ะ แพงขึ้น 20%	https://res.cloudinary.com/djqdn2zru/image/upload/v1757608039/food-menu/hserelfmmpvtup06j3lb.jpg	2025-09-11 23:27:20.249612	13.736717	100.523186	00:00	07:11	f	f	\N	0.0	23/1 เชียงเครือ	-	f	1	t	0
47	47	ร้านผลไม้สด	ขายผลไม้ทุกชนิด	https://res.cloudinary.com/djqdn2zru/image/upload/v1760662375/Market-LOGO/fwyzdo3uiuocnraa04ak.jpg	2025-10-17 07:52:55.767128	72.59838236851405	-96.7843871936202	06:00	17:52	t	f	\N	\N	หอตาลฟ้า	093333333333	t	\N	f	0
\.


--
-- TOC entry 3753 (class 0 OID 16487)
-- Dependencies: 237
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (item_id, order_id, food_id, food_name, quantity, sell_price, subtotal, selected_options, original_price, original_subtotal, original_options, additional_notes, is_reviewed) FROM stdin;
\.


--
-- TOC entry 3755 (class 0 OID 16499)
-- Dependencies: 239
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (order_id, user_id, market_id, rider_id, address, delivery_type, payment_method, note, distance_km, delivery_fee, total_price, status, created_at, updated_at, address_id, rider_required_gp, bonus, original_total_price, shop_status, delivery_photo, is_market_reviewed, is_rider_reviewed) FROM stdin;
\.


--
-- TOC entry 3757 (class 0 OID 16514)
-- Dependencies: 241
-- Data for Name: rider_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_addresses (address_id, user_id, house_number, street, subdistrict, district, province, postal_code, is_default, created_at, updated_at) FROM stdin;
7	35	388	\N	เชียงเครือ	เมือง	สกล	\N	t	2025-09-19 12:40:32.191355	2025-09-19 12:40:32.191355
8	45	t	\N	กะเฉด	เมืองระยอง	ระยอง	\N	t	2025-10-15 19:20:48.328898	2025-10-15 19:20:48.328898
\.


--
-- TOC entry 3759 (class 0 OID 16523)
-- Dependencies: 243
-- Data for Name: rider_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_profiles (rider_id, user_id, id_card_number, id_card_photo_url, id_card_selfie_url, driving_license_number, driving_license_photo_url, vehicle_type, vehicle_brand_model, vehicle_color, vehicle_photo_url, vehicle_registration_photo_url, approval_status, approved_by, approved_at, rejection_reason, created_at, updated_at, vehicle_registration_number, vehicle_registration_province, promptpay, gp_balance, rating, reviews_count) FROM stdin;
10	35	9901700123459	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260702/rider-documents/ppufc7us313g6qem5zkp.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260701/rider-documents/hphwpjueczxwksykhlmr.png	DL1234568	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260703/rider-documents/n6ycoqgi3oz0wy3db1cj.png	motorcycle	Honda Wave	Red	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260704/rider-documents/qslldgochuknpxqns2hn.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260705/rider-documents/itjr5smgaraqqtadtlzb.png	approved	1	\N	\N	2025-09-19 12:44:59.694794	2025-10-17 06:16:21.688124	ฟก-123	สกลนคร	1234556789012	5875.00	0.0	0
11	45	1560528864554	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530956/rider-documents/i7fitnarwwldd3zxv7zn.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530955/rider-documents/qmebayouuhdu7gfuvnjt.jpg	12356788	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530957/rider-documents/ajjpa2tveycyxnvmky9k.jpg	motorcycle	hcjcfu	red	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530959/rider-documents/ikedac3ptle9rzap78cp.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530960/rider-documents/cuuzoncicyrqixvdnglu.jpg	approved	1	2025-10-15 19:42:04.201079	\N	2025-10-15 19:22:33.223371	2025-10-17 06:16:21.688124	yyy	ggg	0989520103	138.00	0.0	0
\.


--
-- TOC entry 3761 (class 0 OID 16539)
-- Dependencies: 245
-- Data for Name: rider_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_reviews (review_id, order_id, user_id, rider_id, rating, comment, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3763 (class 0 OID 16548)
-- Dependencies: 247
-- Data for Name: rider_topups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_topups (topup_id, user_id, amount, slip_url, status, rejection_reason, admin_id, approved_at, created_at, updated_at, rider_id) FROM stdin;
8	35	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758354174/rider-topup-slips/saw8oh6ix5tco7ywezb9.png	approved	\N	1	2025-09-20 14:43:05.86128	2025-09-20 14:42:56.310851	2025-09-20 14:43:05.86128	10
6	35	70.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758353858/rider-topup-slips/bkxhe9kj96juhq1r0awr.png	rejected	กาก	15	\N	2025-09-20 14:37:40.950213	2025-10-06 01:36:02.76336	10
7	35	2000.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758354121/rider-topup-slips/ydszj1lrbj6c7ytlaeiw.png	approved	\N	1	2025-10-06 14:38:38.659389	2025-09-20 14:42:03.258358	2025-10-06 14:38:38.659389	10
9	45	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760534040/rider-topup-slips/girhh6gauhisfki6o2ur.png	approved	\N	1	2025-10-15 20:14:32.468291	2025-10-15 20:14:02.373438	2025-10-15 20:14:32.468291	11
10	45	200.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760534106/rider-topup-slips/vzmomb2tiur7wcp3uysd.jpg	approved	\N	1	2025-10-15 20:15:12.637909	2025-10-15 20:15:07.818018	2025-10-15 20:15:12.637909	11
11	45	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760534153/rider-topup-slips/tkrggfnuwmvs2mq39xqp.jpg	rejected	ขี้ตั๋ว	1	\N	2025-10-15 20:15:54.09448	2025-10-15 20:16:11.27741	11
12	45	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760534263/rider-topup-slips/v9y0in4pdic2szdjfhly.png	rejected	มั่ว	1	\N	2025-10-15 20:17:44.424799	2025-10-15 20:17:59.598133	11
13	45	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760650523/rider-topup-slips/hf7mgmjyk21gfotwxywi.jpg	pending	\N	\N	\N	2025-10-17 04:35:23.949304	2025-10-17 04:35:23.949304	11
\.


--
-- TOC entry 3765 (class 0 OID 16558)
-- Dependencies: 249
-- Data for Name: shop_closed_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shop_closed_reports (report_id, order_id, market_id, rider_id, reason, note, image_urls, status, reviewed_by, reviewed_at, created_at, updated_at) FROM stdin;
8	\N	39	10	ร้านปิดชั่วคราว	ไม่มีคนอยู่ในร้าน	{http://0.0.0.0:4000/uploads/shop_closed/shopclosed_1760438349626_724130693.jpeg,http://0.0.0.0:4000/uploads/shop_closed/shopclosed_1760438349627_352237942.jpeg}	pending	\N	\N	2025-10-14 17:39:09.635337	2025-10-14 17:39:09.635337
14	\N	45	10	ร้านไม่อยู่ในพื้นที่	\N	{http://10.164.109.44:4000/uploads/shop_closed/shopclosed_1760455696628_523435492.jpg,http://10.164.109.44:4000/uploads/shop_closed/shopclosed_1760455696646_491273531.jpg}	pending	\N	\N	2025-10-14 22:28:17.039717	2025-10-14 22:28:17.039717
12	\N	\N	10	ร้านปิดชั่วคราว	\N	{}	pending	\N	2025-10-14 22:12:31.219977	2025-10-14 21:02:42.031228	2025-10-14 22:12:31.219977
10	\N	\N	10	โทรไม่ติด / ไม่มีคนรับสาย	\N	{}	pending	\N	\N	2025-10-14 20:57:19.06891	2025-10-14 20:57:19.06891
13	\N	\N	10	ร้านย้ายที่ตั้ง	ร้านปิดสัส	{http://10.164.109.44:4000/uploads/shop_closed/shopclosed_1760450675948_499915471.jpg}	checked	\N	2025-10-14 21:55:23.695013	2025-10-14 21:04:35.984919	2025-10-14 21:55:23.695013
\.


--
-- TOC entry 3767 (class 0 OID 16568)
-- Dependencies: 251
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, google_id, display_name, email, password, birthdate, gender, phone, created_at, is_verified, photo_url, providers, is_seller, role, fcm_token) FROM stdin;
32	101628051506191273987	Taweechok Khamphusa	aumt1569@gmail.com	\N	\N	\N	\N	2025-09-10 20:09:47.358897	f	https://lh3.googleusercontent.com/a/ACg8ocJw8scPixF2PrzJUUzpznN9BOXF94U_ylti8av5jpEvQ9CN4g=s96-c	google	f	member	\N
35	\N	เย้ๆ123	test@example.com	$2b$10$tykFKP4xLP9Q5YRA2MXgOuQs/91k86YMUYOa5LsVsbd.nc0ugqEO6	1989-12-27	0	0895687260	2025-09-19 12:40:32.191355	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1758727167/rider-profiles/gtm79synxqid0d52wfq9.png	\N	t	rider	\N
34	118325243465533209842	ณัฐวุฒิ สุวรรณศรี	nuttass009@gmail.com	\N	2000-01-21	0	0203640923	2025-09-18 16:35:42.200299	t	https://lh3.googleusercontent.com/a/ACg8ocLfWHIvZ9WWZTZIFHtxYHNZ3WtrMGXqK2QakqUx--csINqEPQY=s96-c	google	t	member	\N
36	\N	Name lol	na@na.com	$2b$10$pkg9.0iqwmKp8m7jTpsFDuJlyxLCYqnbXjRg0GDL7xOvDNJpxkdK.	2000-01-15	0	0924287042	2025-09-19 18:04:08.192117	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1758281188/Market-LOGO/omheznsanssc2cjii6ww.jpg	manual	t	member	\N
31	105392817902249087793	Taweechok KHAMPHUSA	taweechok.k@ku.th	\N	2003-07-03	0	0989520103	2025-09-10 14:42:48.63126	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1760526155/Market-LOGO/clfhrygdacxucabqia6c.jpg	google	t	member	\N
41	113608970896437541477	ปองมณี คําภูษา	pongmnee73@gmail.com	\N	\N	\N	\N	2025-10-15 18:38:29.592526	f	https://lh3.googleusercontent.com/a/ACg8ocK0RKutJveFfp_Cc-VcRGRhcJNVnxcQjrEyjIhlwHJhYepmPQ=s96-c	google	f	rider	\N
44	105426277786935562046	taweechok khamphusa	aumtch0@gmail.com	\N	\N	\N	\N	2025-10-15 19:18:33.992396	f	https://lh3.googleusercontent.com/a/ACg8ocLhitygVoLkOorCQb1eXQKeMRnO8QEYPqHRgBdySs_Rl8_EBA=s96-c	google	f	rider	\N
45	\N	คน	aumtch1@gmail.com	$2b$10$EUeV17/tqcNkcst4nLp0LOQq9dJ0DOeoHkj8/CTPgigl3eU4m/tD2	2003-01-04	0	0852147963	2025-10-15 19:20:48.328898	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530850/rider-profiles/livqqmtzpyu0ie8ggfja.png	\N	f	rider	\N
46	\N	สมรักษ์ สาเทียน	mon22opz@gmail.com	$2b$10$p4mZic0sgLncwDxkVhYVP.xPpgRQFaQR.kPGQSBC9gojLRW2iF2wK	2000-01-17	0	0933843575	2025-10-17 07:25:10.201178	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1760660709/Market-LOGO/ocvxytx5wh0ktdnraexa.jpg	manual	t	member	\N
47	\N	bae jinsol	shora2256@gmail.com	$2b$10$PPv9dyEazehgZZsT/thKc.BrxjFqyToY6g5aF3kpqu9trc2KaqN4.	2000-01-18	1	08888888888	2025-10-17 07:48:27.1911	t	https://res.cloudinary.com/djqdn2zru/image/upload/v1760662106/Market-LOGO/y3wpgttonzekf6hpqmml.jpg	manual	t	member	\N
\.


--
-- TOC entry 3815 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 15, true);


--
-- TOC entry 3816 (class 0 OID 0)
-- Dependencies: 218
-- Name: carts_cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carts_cart_id_seq', 321, true);


--
-- TOC entry 3817 (class 0 OID 0)
-- Dependencies: 220
-- Name: categorys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorys_id_seq', 15, true);


--
-- TOC entry 3818 (class 0 OID 0)
-- Dependencies: 222
-- Name: chat_messages_message_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_messages_message_id_seq', 126, true);


--
-- TOC entry 3819 (class 0 OID 0)
-- Dependencies: 224
-- Name: chat_rooms_room_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_rooms_room_id_seq', 33, true);


--
-- TOC entry 3820 (class 0 OID 0)
-- Dependencies: 226
-- Name: client_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.client_addresses_id_seq', 13, true);


--
-- TOC entry 3821 (class 0 OID 0)
-- Dependencies: 228
-- Name: complaints_complaint_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.complaints_complaint_id_seq', 3, true);


--
-- TOC entry 3822 (class 0 OID 0)
-- Dependencies: 230
-- Name: food_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.food_reviews_review_id_seq', 42, true);


--
-- TOC entry 3823 (class 0 OID 0)
-- Dependencies: 232
-- Name: foods_food_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.foods_food_id_seq', 64, true);


--
-- TOC entry 3824 (class 0 OID 0)
-- Dependencies: 234
-- Name: market_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.market_reviews_review_id_seq', 44, true);


--
-- TOC entry 3825 (class 0 OID 0)
-- Dependencies: 236
-- Name: markets_market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.markets_market_id_seq', 49, true);


--
-- TOC entry 3826 (class 0 OID 0)
-- Dependencies: 238
-- Name: order_items_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_item_id_seq', 279, true);


--
-- TOC entry 3827 (class 0 OID 0)
-- Dependencies: 240
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 272, true);


--
-- TOC entry 3828 (class 0 OID 0)
-- Dependencies: 242
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_addresses_address_id_seq', 8, true);


--
-- TOC entry 3829 (class 0 OID 0)
-- Dependencies: 244
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_profiles_rider_id_seq', 11, true);


--
-- TOC entry 3830 (class 0 OID 0)
-- Dependencies: 246
-- Name: rider_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_reviews_review_id_seq', 26, true);


--
-- TOC entry 3831 (class 0 OID 0)
-- Dependencies: 248
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_topups_topup_id_seq', 13, true);


--
-- TOC entry 3832 (class 0 OID 0)
-- Dependencies: 250
-- Name: shop_closed_reports_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shop_closed_reports_report_id_seq', 14, true);


--
-- TOC entry 3833 (class 0 OID 0)
-- Dependencies: 252
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 47, true);


--
-- TOC entry 3458 (class 2606 OID 16598)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 3460 (class 2606 OID 16600)
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- TOC entry 3462 (class 2606 OID 16602)
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (cart_id);


--
-- TOC entry 3464 (class 2606 OID 16604)
-- Name: categorys categorys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys
    ADD CONSTRAINT categorys_pkey PRIMARY KEY (id);


--
-- TOC entry 3466 (class 2606 OID 16606)
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (message_id);


--
-- TOC entry 3470 (class 2606 OID 16608)
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (room_id);


--
-- TOC entry 3477 (class 2606 OID 16610)
-- Name: client_addresses client_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses
    ADD CONSTRAINT client_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 3479 (class 2606 OID 16612)
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (complaint_id);


--
-- TOC entry 3481 (class 2606 OID 16614)
-- Name: food_reviews food_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT food_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 3485 (class 2606 OID 16616)
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (food_id);


--
-- TOC entry 3489 (class 2606 OID 16618)
-- Name: market_reviews market_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 3493 (class 2606 OID 16620)
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (market_id);


--
-- TOC entry 3496 (class 2606 OID 16622)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (item_id);


--
-- TOC entry 3501 (class 2606 OID 16624)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 3506 (class 2606 OID 16626)
-- Name: rider_addresses rider_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT rider_addresses_pkey PRIMARY KEY (address_id);


--
-- TOC entry 3515 (class 2606 OID 16628)
-- Name: rider_profiles rider_profiles_driving_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_driving_license_number_key UNIQUE (driving_license_number);


--
-- TOC entry 3517 (class 2606 OID 16630)
-- Name: rider_profiles rider_profiles_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_id_card_number_key UNIQUE (id_card_number);


--
-- TOC entry 3519 (class 2606 OID 16632)
-- Name: rider_profiles rider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_pkey PRIMARY KEY (rider_id);


--
-- TOC entry 3521 (class 2606 OID 16634)
-- Name: rider_profiles rider_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 3527 (class 2606 OID 16636)
-- Name: rider_reviews rider_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 3535 (class 2606 OID 16638)
-- Name: rider_topups rider_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_pkey PRIMARY KEY (topup_id);


--
-- TOC entry 3537 (class 2606 OID 16640)
-- Name: shop_closed_reports shop_closed_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_pkey PRIMARY KEY (report_id);


--
-- TOC entry 3483 (class 2606 OID 16642)
-- Name: food_reviews unique_food_review_per_item; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT unique_food_review_per_item UNIQUE (order_item_id, user_id);


--
-- TOC entry 3523 (class 2606 OID 16644)
-- Name: rider_profiles unique_vehicle_registration; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT unique_vehicle_registration UNIQUE (vehicle_registration_number, vehicle_registration_province);


--
-- TOC entry 3475 (class 2606 OID 16646)
-- Name: chat_rooms uq_chat_room_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT uq_chat_room_order UNIQUE (order_id);


--
-- TOC entry 3491 (class 2606 OID 16648)
-- Name: market_reviews uq_market_review_per_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT uq_market_review_per_order UNIQUE (order_id);


--
-- TOC entry 3529 (class 2606 OID 16650)
-- Name: rider_reviews uq_rider_review_per_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT uq_rider_review_per_order UNIQUE (order_id);


--
-- TOC entry 3539 (class 2606 OID 16652)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3541 (class 2606 OID 16654)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3467 (class 1259 OID 16655)
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);


--
-- TOC entry 3468 (class 1259 OID 16656)
-- Name: idx_chat_messages_room_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_room_id ON public.chat_messages USING btree (room_id);


--
-- TOC entry 3471 (class 1259 OID 16657)
-- Name: idx_chat_rooms_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_customer_id ON public.chat_rooms USING btree (customer_id);


--
-- TOC entry 3472 (class 1259 OID 16658)
-- Name: idx_chat_rooms_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_order_id ON public.chat_rooms USING btree (order_id);


--
-- TOC entry 3473 (class 1259 OID 16659)
-- Name: idx_chat_rooms_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_rider_id ON public.chat_rooms USING btree (rider_id);


--
-- TOC entry 3486 (class 1259 OID 16660)
-- Name: idx_market_reviews_market_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_reviews_market_id ON public.market_reviews USING btree (market_id);


--
-- TOC entry 3487 (class 1259 OID 16661)
-- Name: idx_market_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_reviews_user_id ON public.market_reviews USING btree (user_id);


--
-- TOC entry 3494 (class 1259 OID 16662)
-- Name: idx_order_items_original_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_original_price ON public.order_items USING btree (original_price);


--
-- TOC entry 3497 (class 1259 OID 16663)
-- Name: idx_orders_market_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_market_status_created ON public.orders USING btree (market_id, status, created_at);


--
-- TOC entry 3498 (class 1259 OID 16664)
-- Name: idx_orders_original_total_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_original_total_price ON public.orders USING btree (original_total_price);


--
-- TOC entry 3499 (class 1259 OID 16665)
-- Name: idx_orders_shop_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_shop_status ON public.orders USING btree (shop_status);


--
-- TOC entry 3502 (class 1259 OID 16666)
-- Name: idx_rider_addresses_district; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_district ON public.rider_addresses USING btree (district, province);


--
-- TOC entry 3503 (class 1259 OID 16667)
-- Name: idx_rider_addresses_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_province ON public.rider_addresses USING btree (province);


--
-- TOC entry 3504 (class 1259 OID 16668)
-- Name: idx_rider_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_user_id ON public.rider_addresses USING btree (user_id);


--
-- TOC entry 3507 (class 1259 OID 16669)
-- Name: idx_rider_profiles_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_approval_status ON public.rider_profiles USING btree (approval_status);


--
-- TOC entry 3508 (class 1259 OID 16670)
-- Name: idx_rider_profiles_driving_license_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_driving_license_number ON public.rider_profiles USING btree (driving_license_number);


--
-- TOC entry 3509 (class 1259 OID 16671)
-- Name: idx_rider_profiles_id_card_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_id_card_number ON public.rider_profiles USING btree (id_card_number);


--
-- TOC entry 3510 (class 1259 OID 16672)
-- Name: idx_rider_profiles_promptpay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_promptpay ON public.rider_profiles USING btree (promptpay);


--
-- TOC entry 3511 (class 1259 OID 16673)
-- Name: idx_rider_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_user_id ON public.rider_profiles USING btree (user_id);


--
-- TOC entry 3512 (class 1259 OID 16674)
-- Name: idx_rider_profiles_vehicle_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles USING btree (vehicle_registration_province);


--
-- TOC entry 3513 (class 1259 OID 16675)
-- Name: idx_rider_profiles_vehicle_registration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles USING btree (vehicle_registration_number);


--
-- TOC entry 3524 (class 1259 OID 16676)
-- Name: idx_rider_reviews_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_reviews_rider_id ON public.rider_reviews USING btree (rider_id);


--
-- TOC entry 3525 (class 1259 OID 16677)
-- Name: idx_rider_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_reviews_user_id ON public.rider_reviews USING btree (user_id);


--
-- TOC entry 3530 (class 1259 OID 16678)
-- Name: idx_rider_topups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_created_at ON public.rider_topups USING btree (created_at);


--
-- TOC entry 3531 (class 1259 OID 16679)
-- Name: idx_rider_topups_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_rider_id ON public.rider_topups USING btree (rider_id);


--
-- TOC entry 3532 (class 1259 OID 16680)
-- Name: idx_rider_topups_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_status ON public.rider_topups USING btree (status);


--
-- TOC entry 3533 (class 1259 OID 16681)
-- Name: idx_rider_topups_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_user_id ON public.rider_topups USING btree (user_id);


--
-- TOC entry 3582 (class 2620 OID 16682)
-- Name: market_reviews trg_market_reviews_aiud; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_market_reviews_aiud AFTER INSERT OR DELETE OR UPDATE ON public.market_reviews FOR EACH ROW EXECUTE FUNCTION public._after_market_review_change();


--
-- TOC entry 3586 (class 2620 OID 16683)
-- Name: rider_reviews trg_rider_reviews_aiud; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_rider_reviews_aiud AFTER INSERT OR DELETE OR UPDATE ON public.rider_reviews FOR EACH ROW EXECUTE FUNCTION public._after_rider_review_change();


--
-- TOC entry 3583 (class 2620 OID 16684)
-- Name: market_reviews trg_validate_market_review; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_market_review BEFORE INSERT OR UPDATE ON public.market_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_market_review();


--
-- TOC entry 3587 (class 2620 OID 16685)
-- Name: rider_reviews trg_validate_rider_review; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_rider_review BEFORE INSERT OR UPDATE ON public.rider_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_rider_review();


--
-- TOC entry 3581 (class 2620 OID 16686)
-- Name: chat_rooms update_chat_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3584 (class 2620 OID 16687)
-- Name: rider_addresses update_rider_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_addresses_updated_at BEFORE UPDATE ON public.rider_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3585 (class 2620 OID 16688)
-- Name: rider_profiles update_rider_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3542 (class 2606 OID 16689)
-- Name: carts carts_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 3543 (class 2606 OID 16694)
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3544 (class 2606 OID 16699)
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE;


--
-- TOC entry 3545 (class 2606 OID 16704)
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3546 (class 2606 OID 16709)
-- Name: chat_rooms chat_rooms_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3547 (class 2606 OID 16714)
-- Name: chat_rooms chat_rooms_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3548 (class 2606 OID 16719)
-- Name: chat_rooms chat_rooms_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE CASCADE;


--
-- TOC entry 3549 (class 2606 OID 16724)
-- Name: complaints complaints_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE SET NULL;


--
-- TOC entry 3550 (class 2606 OID 16729)
-- Name: complaints complaints_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE SET NULL;


--
-- TOC entry 3551 (class 2606 OID 16734)
-- Name: complaints complaints_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 3566 (class 2606 OID 16739)
-- Name: orders fk_address; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_address FOREIGN KEY (address_id) REFERENCES public.client_addresses(id);


--
-- TOC entry 3562 (class 2606 OID 16744)
-- Name: markets fk_admin; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 3552 (class 2606 OID 16749)
-- Name: food_reviews fk_food_reviews_food; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_food FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 3553 (class 2606 OID 16754)
-- Name: food_reviews fk_food_reviews_market; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_market FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3554 (class 2606 OID 16759)
-- Name: food_reviews fk_food_reviews_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_order FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3555 (class 2606 OID 16764)
-- Name: food_reviews fk_food_reviews_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3568 (class 2606 OID 16769)
-- Name: rider_addresses fk_rider_addresses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT fk_rider_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3569 (class 2606 OID 16774)
-- Name: rider_profiles fk_rider_profiles_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES public.admins(id);


--
-- TOC entry 3570 (class 2606 OID 16779)
-- Name: rider_profiles fk_rider_profiles_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3556 (class 2606 OID 16784)
-- Name: food_reviews food_reviews_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT food_reviews_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(item_id) ON DELETE CASCADE;


--
-- TOC entry 3557 (class 2606 OID 16789)
-- Name: foods foods_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categorys(id);


--
-- TOC entry 3558 (class 2606 OID 16794)
-- Name: foods foods_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3559 (class 2606 OID 16799)
-- Name: market_reviews market_reviews_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3560 (class 2606 OID 16804)
-- Name: market_reviews market_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3561 (class 2606 OID 16809)
-- Name: market_reviews market_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3563 (class 2606 OID 16814)
-- Name: markets markets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


--
-- TOC entry 3564 (class 2606 OID 16819)
-- Name: order_items order_items_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id);


--
-- TOC entry 3565 (class 2606 OID 16824)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3567 (class 2606 OID 16829)
-- Name: orders orders_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id);


--
-- TOC entry 3571 (class 2606 OID 16834)
-- Name: rider_reviews rider_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3572 (class 2606 OID 16839)
-- Name: rider_reviews rider_reviews_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE CASCADE;


--
-- TOC entry 3573 (class 2606 OID 16844)
-- Name: rider_reviews rider_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3574 (class 2606 OID 16849)
-- Name: rider_topups rider_topups_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 3575 (class 2606 OID 16854)
-- Name: rider_topups rider_topups_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id);


--
-- TOC entry 3576 (class 2606 OID 16859)
-- Name: rider_topups rider_topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3577 (class 2606 OID 16864)
-- Name: shop_closed_reports shop_closed_reports_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE SET NULL;


--
-- TOC entry 3578 (class 2606 OID 16869)
-- Name: shop_closed_reports shop_closed_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE SET NULL;


--
-- TOC entry 3579 (class 2606 OID 16874)
-- Name: shop_closed_reports shop_closed_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.admins(id) ON DELETE SET NULL;


--
-- TOC entry 3580 (class 2606 OID 16879)
-- Name: shop_closed_reports shop_closed_reports_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE SET NULL;


-- Completed on 2025-10-17 09:47:47 +07

--
-- PostgreSQL database dump complete
--

\unrestrict 7i9jmpqvS2vDqfZaw67yXpkpuAqdxcdL7URBq4RsvmYoB1yCHVq9LQH5E8YLN85

