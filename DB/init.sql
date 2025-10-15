--
-- PostgreSQL database dump
--

\restrict VWLxW5Adc7OxaNcOj3NP2jKrXuuHKCPoNyp5KzVXumSYc86uJE1qGBLe866dpEf

-- Dumped from database version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)

-- Started on 2025-10-15 23:08:32 +07

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
-- TOC entry 253 (class 1255 OID 25356)
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
-- TOC entry 254 (class 1255 OID 25357)
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
-- TOC entry 255 (class 1255 OID 25358)
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
-- TOC entry 256 (class 1255 OID 25359)
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
-- TOC entry 257 (class 1255 OID 25360)
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
-- TOC entry 258 (class 1255 OID 25361)
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
-- TOC entry 259 (class 1255 OID 25362)
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
-- TOC entry 260 (class 1255 OID 25363)
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
-- TOC entry 215 (class 1259 OID 25364)
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
-- TOC entry 216 (class 1259 OID 25370)
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
-- TOC entry 3755 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 217 (class 1259 OID 25371)
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
-- TOC entry 218 (class 1259 OID 25378)
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
-- TOC entry 3756 (class 0 OID 0)
-- Dependencies: 218
-- Name: carts_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carts_cart_id_seq OWNED BY public.carts.cart_id;


--
-- TOC entry 219 (class 1259 OID 25379)
-- Name: categorys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorys (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    cate_image_url text
);


ALTER TABLE public.categorys OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 25384)
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
-- TOC entry 3757 (class 0 OID 0)
-- Dependencies: 220
-- Name: categorys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorys_id_seq OWNED BY public.categorys.id;


--
-- TOC entry 221 (class 1259 OID 25385)
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
-- TOC entry 222 (class 1259 OID 25394)
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
-- TOC entry 3758 (class 0 OID 0)
-- Dependencies: 222
-- Name: chat_messages_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_message_id_seq OWNED BY public.chat_messages.message_id;


--
-- TOC entry 223 (class 1259 OID 25395)
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
-- TOC entry 224 (class 1259 OID 25401)
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
-- TOC entry 3759 (class 0 OID 0)
-- Dependencies: 224
-- Name: chat_rooms_room_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_rooms_room_id_seq OWNED BY public.chat_rooms.room_id;


--
-- TOC entry 225 (class 1259 OID 25402)
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
-- TOC entry 226 (class 1259 OID 25408)
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
-- TOC entry 3760 (class 0 OID 0)
-- Dependencies: 226
-- Name: client_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_addresses_id_seq OWNED BY public.client_addresses.id;


--
-- TOC entry 250 (class 1259 OID 25793)
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
-- TOC entry 249 (class 1259 OID 25792)
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
-- TOC entry 3761 (class 0 OID 0)
-- Dependencies: 249
-- Name: complaints_complaint_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.complaints_complaint_id_seq OWNED BY public.complaints.complaint_id;


--
-- TOC entry 248 (class 1259 OID 25754)
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
-- TOC entry 247 (class 1259 OID 25753)
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
-- TOC entry 3762 (class 0 OID 0)
-- Dependencies: 247
-- Name: food_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.food_reviews_review_id_seq OWNED BY public.food_reviews.review_id;


--
-- TOC entry 227 (class 1259 OID 25409)
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
    created_by_admin_id integer
);


ALTER TABLE public.foods OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 25417)
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
-- TOC entry 3763 (class 0 OID 0)
-- Dependencies: 228
-- Name: foods_food_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.foods_food_id_seq OWNED BY public.foods.food_id;


--
-- TOC entry 229 (class 1259 OID 25418)
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
-- TOC entry 230 (class 1259 OID 25426)
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
-- TOC entry 3764 (class 0 OID 0)
-- Dependencies: 230
-- Name: market_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.market_reviews_review_id_seq OWNED BY public.market_reviews.review_id;


--
-- TOC entry 231 (class 1259 OID 25427)
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
-- TOC entry 232 (class 1259 OID 25438)
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
-- TOC entry 3765 (class 0 OID 0)
-- Dependencies: 232
-- Name: markets_market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.markets_market_id_seq OWNED BY public.markets.market_id;


--
-- TOC entry 233 (class 1259 OID 25439)
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
-- TOC entry 3766 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN order_items.original_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_price IS 'ราคาต้นทุนก่อนบวก%เพิ่ม';


--
-- TOC entry 3767 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN order_items.original_subtotal; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_subtotal IS 'ราคารวมต้นทุนก่อนบวก%เพิ่ม (original_price * quantity)';


--
-- TOC entry 3768 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN order_items.original_options; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.original_options IS 'ตัวเลือกอาหารราคาต้นทุนก่อนบวก%เพิ่ม';


--
-- TOC entry 3769 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN order_items.additional_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.additional_notes IS 'รายละเอียดเพิ่มเติมของแต่ละเมนู เช่น ไม่ใส่ผักชี, เผ็ดน้อย, ไม่ใส่น้ำแข็ง';


--
-- TOC entry 234 (class 1259 OID 25448)
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
-- TOC entry 3770 (class 0 OID 0)
-- Dependencies: 234
-- Name: order_items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_item_id_seq OWNED BY public.order_items.item_id;


--
-- TOC entry 235 (class 1259 OID 25449)
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
-- TOC entry 3771 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN orders.original_total_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.original_total_price IS 'ราคารวมต้นทุนก่อนบวก%เพิ่ม (ไม่รวมค่าส่ง)';


--
-- TOC entry 236 (class 1259 OID 25461)
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
-- TOC entry 3772 (class 0 OID 0)
-- Dependencies: 236
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- TOC entry 237 (class 1259 OID 25462)
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
-- TOC entry 3773 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE rider_addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_addresses IS 'ตารางเก็บที่อยู่ของไรเดอร์';


--
-- TOC entry 3774 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN rider_addresses.subdistrict; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.subdistrict IS 'ตำบล';


--
-- TOC entry 3775 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN rider_addresses.district; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.district IS 'อำเภอ';


--
-- TOC entry 3776 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN rider_addresses.province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_addresses.province IS 'จังหวัด';


--
-- TOC entry 238 (class 1259 OID 25470)
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
-- TOC entry 3777 (class 0 OID 0)
-- Dependencies: 238
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_addresses_address_id_seq OWNED BY public.rider_addresses.address_id;


--
-- TOC entry 239 (class 1259 OID 25471)
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
-- TOC entry 3778 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE rider_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_profiles IS 'ตารางเก็บข้อมูลไรเดอร์ที่ต้องการยืนยันตัวตน';


--
-- TOC entry 3779 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.id_card_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_photo_url IS 'รูปถ่ายบัตรประชาชน';


--
-- TOC entry 3780 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.id_card_selfie_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.id_card_selfie_url IS 'รูปถ่ายคู่บัตรประชาชน';


--
-- TOC entry 3781 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.driving_license_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.driving_license_photo_url IS 'รูปใบขับขี่';


--
-- TOC entry 3782 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.vehicle_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_type IS 'ประเภทรถ (ปัจจุบันรองรับแค่ motorcycle)';


--
-- TOC entry 3783 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.vehicle_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_photo_url IS 'รูปถ่ายรถ';


--
-- TOC entry 3784 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.vehicle_registration_photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_photo_url IS 'รูปคู่มือทะเบียนรถ';


--
-- TOC entry 3785 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.vehicle_registration_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';


--
-- TOC entry 3786 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.vehicle_registration_province; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';


--
-- TOC entry 3787 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN rider_profiles.promptpay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_profiles.promptpay IS 'หมายเลข PromptPay (เบอร์โทร 10 หลักหรือเลขบัตรประชาชน 13 หลัก)';


--
-- TOC entry 240 (class 1259 OID 25486)
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
-- TOC entry 3788 (class 0 OID 0)
-- Dependencies: 240
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_profiles_rider_id_seq OWNED BY public.rider_profiles.rider_id;


--
-- TOC entry 241 (class 1259 OID 25487)
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
-- TOC entry 242 (class 1259 OID 25495)
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
-- TOC entry 3789 (class 0 OID 0)
-- Dependencies: 242
-- Name: rider_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_reviews_review_id_seq OWNED BY public.rider_reviews.review_id;


--
-- TOC entry 243 (class 1259 OID 25496)
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
-- TOC entry 3790 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE rider_topups; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rider_topups IS 'ตารางเก็บข้อมูลการเติมเงิน GP ของไรเดอร์';


--
-- TOC entry 3791 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_topups.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.user_id IS 'รหัสผู้ใช้ที่เป็นไรเดอร์ (อ้างอิงจาก users table)';


--
-- TOC entry 3792 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN rider_topups.rider_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rider_topups.rider_id IS 'รหัสไรเดอร์ (อ้างอิงจาก rider_profiles table)';


--
-- TOC entry 244 (class 1259 OID 25505)
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
-- TOC entry 3793 (class 0 OID 0)
-- Dependencies: 244
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rider_topups_topup_id_seq OWNED BY public.rider_topups.topup_id;


--
-- TOC entry 252 (class 1259 OID 26080)
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
    CONSTRAINT shop_closed_reports_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'checked'::character varying])::text[])))
);


ALTER TABLE public.shop_closed_reports OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 26079)
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
-- TOC entry 3794 (class 0 OID 0)
-- Dependencies: 251
-- Name: shop_closed_reports_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shop_closed_reports_report_id_seq OWNED BY public.shop_closed_reports.report_id;


--
-- TOC entry 245 (class 1259 OID 25506)
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
-- TOC entry 246 (class 1259 OID 25515)
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
-- TOC entry 3795 (class 0 OID 0)
-- Dependencies: 246
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 3347 (class 2604 OID 25516)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 3349 (class 2604 OID 25517)
-- Name: carts cart_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts ALTER COLUMN cart_id SET DEFAULT nextval('public.carts_cart_id_seq'::regclass);


--
-- TOC entry 3352 (class 2604 OID 25518)
-- Name: categorys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys ALTER COLUMN id SET DEFAULT nextval('public.categorys_id_seq'::regclass);


--
-- TOC entry 3353 (class 2604 OID 25519)
-- Name: chat_messages message_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN message_id SET DEFAULT nextval('public.chat_messages_message_id_seq'::regclass);


--
-- TOC entry 3357 (class 2604 OID 25520)
-- Name: chat_rooms room_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms ALTER COLUMN room_id SET DEFAULT nextval('public.chat_rooms_room_id_seq'::regclass);


--
-- TOC entry 3361 (class 2604 OID 25521)
-- Name: client_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses ALTER COLUMN id SET DEFAULT nextval('public.client_addresses_id_seq'::regclass);


--
-- TOC entry 3421 (class 2604 OID 25796)
-- Name: complaints complaint_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints ALTER COLUMN complaint_id SET DEFAULT nextval('public.complaints_complaint_id_seq'::regclass);


--
-- TOC entry 3418 (class 2604 OID 25757)
-- Name: food_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.food_reviews_review_id_seq'::regclass);


--
-- TOC entry 3363 (class 2604 OID 25522)
-- Name: foods food_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods ALTER COLUMN food_id SET DEFAULT nextval('public.foods_food_id_seq'::regclass);


--
-- TOC entry 3367 (class 2604 OID 25523)
-- Name: market_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.market_reviews_review_id_seq'::regclass);


--
-- TOC entry 3370 (class 2604 OID 25524)
-- Name: markets market_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets ALTER COLUMN market_id SET DEFAULT nextval('public.markets_market_id_seq'::regclass);


--
-- TOC entry 3377 (class 2604 OID 25525)
-- Name: order_items item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN item_id SET DEFAULT nextval('public.order_items_item_id_seq'::regclass);


--
-- TOC entry 3384 (class 2604 OID 25526)
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- TOC entry 3393 (class 2604 OID 25527)
-- Name: rider_addresses address_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses ALTER COLUMN address_id SET DEFAULT nextval('public.rider_addresses_address_id_seq'::regclass);


--
-- TOC entry 3397 (class 2604 OID 25528)
-- Name: rider_profiles rider_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles ALTER COLUMN rider_id SET DEFAULT nextval('public.rider_profiles_rider_id_seq'::regclass);


--
-- TOC entry 3406 (class 2604 OID 25529)
-- Name: rider_reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.rider_reviews_review_id_seq'::regclass);


--
-- TOC entry 3409 (class 2604 OID 25530)
-- Name: rider_topups topup_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups ALTER COLUMN topup_id SET DEFAULT nextval('public.rider_topups_topup_id_seq'::regclass);


--
-- TOC entry 3424 (class 2604 OID 26083)
-- Name: shop_closed_reports report_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports ALTER COLUMN report_id SET DEFAULT nextval('public.shop_closed_reports_report_id_seq'::regclass);


--
-- TOC entry 3413 (class 2604 OID 25531)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 3712 (class 0 OID 25364)
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
-- TOC entry 3714 (class 0 OID 25371)
-- Dependencies: 217
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carts (cart_id, user_id, food_id, quantity, selected_options, note, total, created_at) FROM stdin;
119	35	25	1	[{"label": "code", "extraPrice": 12}]		70	2025-09-26 15:59:03.801981
292	31	28	1	[]		58	2025-10-13 21:58:17.41041
293	31	28	1	[{"label": "เผ็ด", "extraPrice": 12}]		70	2025-10-13 21:58:21.923298
294	31	21	1	[]		46	2025-10-13 21:59:19.747206
300	31	19	1	[]		71	2025-10-14 23:57:29.604559
304	34	40	1	[]		120	2025-10-15 01:56:24.054738
\.


--
-- TOC entry 3716 (class 0 OID 25379)
-- Dependencies: 219
-- Data for Name: categorys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorys (id, name, cate_image_url) FROM stdin;
1	ข้าว	https://res.cloudinary.com/djqdn2zru/image/upload/v1759581770/food-menu/i0qoaoo5jqxi4jmxhps7.jpg
2	เครื่องดื่ม	https://res.cloudinary.com/djqdn2zru/image/upload/v1759604045/food-menu/io2q0jl1kuttafsbwmxg.jpg
3	น้ำอัดลม	https://res.cloudinary.com/djqdn2zru/image/upload/v1760184282/food-menu/oamqbmhlqoddqp2rikon.png
\.


--
-- TOC entry 3718 (class 0 OID 25385)
-- Dependencies: 221
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (message_id, room_id, sender_id, sender_type, message_text, message_type, image_url, latitude, longitude, is_read, created_at) FROM stdin;
111	28	45	rider	ดี	text	\N	\N	\N	t	2025-10-15 22:38:18.296232
112	28	45	rider	\N	image	http://10.28.145.44:4000/uploads/chat-images/chat-1760542705073-6089596.jpg	\N	\N	t	2025-10-15 22:38:25.124305
\.


--
-- TOC entry 3720 (class 0 OID 25395)
-- Dependencies: 223
-- Data for Name: chat_rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_rooms (room_id, order_id, customer_id, rider_id, status, created_at, updated_at) FROM stdin;
25	260	31	10	active	2025-10-15 16:13:46.884212	2025-10-15 16:13:46.884212
26	261	31	10	active	2025-10-15 16:26:11.090146	2025-10-15 18:09:30.073529
28	263	31	11	active	2025-10-15 20:59:39.150822	2025-10-15 22:38:48.396099
\.


--
-- TOC entry 3722 (class 0 OID 25402)
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
8	31	เฟียส	0982147653	74CG+G37 74CG+G37 ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000	หน้าร้าน ขายของชำ	17.271748923950433	104.12641134113073	74CG+G37 74CG+G37 ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:17:19.27141	f
7	31	สุดจัด	0849567312	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	อำเภอเมืองสกลนคร	สกลนคร	47000		17.26881945839936	104.13779195398092	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	2025-09-14 18:13:49.04298	t
\.


--
-- TOC entry 3747 (class 0 OID 25793)
-- Dependencies: 250
-- Data for Name: complaints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.complaints (complaint_id, user_id, rider_id, market_id, role, subject, message, evidence_url, created_at, status, updated_at) FROM stdin;
3	35	10	37	rider	asd	abc	/uploads/complaints/complaint-1760345872853-292.jpeg	2025-10-13 15:57:52.878412	checked	2025-10-14 21:52:27.172953
2	35	10	37	rider	asd	abc	\N	2025-10-13 15:52:07.321064	checked	2025-10-14 21:55:57.549323
\.


--
-- TOC entry 3745 (class 0 OID 25754)
-- Dependencies: 248
-- Data for Name: food_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.food_reviews (review_id, order_id, user_id, market_id, food_id, rating, comment, created_at, updated_at, order_item_id) FROM stdin;
36	260	31	37	18	5	ดูดีอร่อยจริง	2025-10-15 16:17:02.693128	2025-10-15 16:17:02.693128	267
37	261	31	37	18	2	ได้เยอะะ อร่อยน่ิย	2025-10-15 16:29:16.932538	2025-10-15 16:29:16.932538	268
\.


--
-- TOC entry 3724 (class 0 OID 25409)
-- Dependencies: 227
-- Data for Name: foods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.foods (food_id, market_id, food_name, price, image_url, created_at, options, rating, sell_price, sell_options, category_id, created_by_admin_id) FROM stdin;
19	38	อ่อมหมู	59.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614871/Market-LOGO/ph5jwppwayvgmih9ohpc.jpg	2025-09-12 01:21:12.136991	[]	\N	71.00	[]	1	\N
20	37	ลข	31.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757654055/Market-LOGO/hwe1fcjovtxmkuyjh17n.jpg	2025-09-12 12:14:16.611986	[]	3.0	35.00	[]	1	\N
21	39	ข้าวสวย	40.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758281505/Market-LOGO/gaglreb9e95cl28nqt9q.jpg	2025-09-19 18:31:46.878776	[{"label": "แมว", "extraPrice": 7.0}]	\N	46.00	[]	1	\N
22	40	วัว	98.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758282287/Market-LOGO/tnslbyic4c81moiot6ln.jpg	2025-09-19 18:44:49.217367	[{"label": "หนังเค็ม", "extraPrice": 20.0}]	\N	112.00	[]	1	\N
23	40	แกงควาย	59.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758297822/Market-LOGO/czebok5syxrx3donwjph.png	2025-09-19 23:03:44.613978	[]	\N	67.00	[]	1	\N
25	43	code	50.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758361159/Market-LOGO/jmrem0pdsqccb2fboheu.jpg	2025-09-20 16:39:21.203733	[{"label": "code", "extraPrice": 10}, {"label": "java", "extraPrice": 6}]	\N	58.00	[{"label": "code", "extraPrice": 12}, {"label": "java", "extraPrice": 7}]	1	\N
26	39	กระเพรานะจ๊ะ	55.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758776507/Market-LOGO/ipfozd0icgjtzqfwxqpf.jpg	2025-09-25 12:01:47.742719	[{"label": "ไข่ดาว", "extraPrice": 6}, {"label": "ไข่เจียว", "extraPrice": 10}, {"label": "ผัก", "extraPrice": 7}]	\N	64.00	[{"label": "ไข่ดาว", "extraPrice": 7}, {"label": "ไข่เจียว", "extraPrice": 12}, {"label": "ผัก", "extraPrice": 9}]	1	\N
27	39	พำ	51.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758799559/Market-LOGO/wopxqzgco2jgldgbydyv.jpg	2025-09-25 18:25:59.813235	[{"label": "พพ", "extraPrice": 3}, {"label": "กอ", "extraPrice": 8}]	\N	59.00	[{"label": "พพ", "extraPrice": 4}, {"label": "กอ", "extraPrice": 10}]	1	\N
28	39	ไก่น้อย	50.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758799728/Market-LOGO/sfg9x7jpbo6ohat0czxf.jpg	2025-09-25 18:28:49.173621	[{"label": "เผ็ด", "extraPrice": 10}, {"label": "ผัก", "extraPrice": 5}]	\N	58.00	[{"label": "เผ็ด", "extraPrice": 12}, {"label": "ผัก", "extraPrice": 6}]	1	\N
29	39	แกงไก่	23.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1758799857/Market-LOGO/ttgl5jlvunk7zj8wmcpi.jpg	2025-09-25 18:30:58.512084	[{"label": "น้ำ", "extraPrice": 3}]	\N	27.00	[{"label": "น้ำ", "extraPrice": 4}]	1	\N
40	45	ข้าวผัด	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760182451/food-menu/lx0mg4lnpssb7mdhdddl.jpg	2025-10-11 18:34:11.880525	[{"label": "๋KaiDown", "extraPrice": 10}]	\N	120.00	[{"label": "๋KaiDown", "extraPrice": 12}]	3	1
41	45	sd	12.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760182812/food-menu/ddjcz4ed4wclhswqj0ks.jpg	2025-10-11 18:40:13.734277	[{"label": "asd", "extraPrice": 10}]	\N	15.00	[{"label": "asd", "extraPrice": 12}]	2	1
32	38	w	12.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1759604597/food-menu/xuh67zkmaq87o05d8wg3.jpg	2025-10-05 02:03:18.277715	[{"label": "2", "extraPrice": 14}]	\N	15.00	[]	\N	\N
18	37	ลาบ	23.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1757614820/Market-LOGO/uxxu9ksyzmbjvejbiba6.jpg	2025-09-12 01:20:20.96686	[{"label": "ไก่", "extraPrice": 10}, {"label": "หมู", "extraPrice": 15}, {"label": "เนื้อ", "extraPrice": 20}, {"label": "เป็ด", "extraPrice": 40}]	\N	27.00	[{"label": "ไก่", "extraPrice": 12}, {"label": "หมู", "extraPrice": 18}, {"label": "เนื้อ", "extraPrice": 23}, {"label": "เป็ด", "extraPrice": 46}]	3	\N
34	44	Kao	100.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1759608282/food-menu/jrc37qiwteqgqrtur6uu.jpg	2025-10-05 03:04:43.424067	[{"label": "k", "extraPrice": 10}, {"label": "e", "extraPrice": 20}]	\N	120.00	[{"name": "k", "extraPrice": 12}, {"name": "e", "extraPrice": 24}]	1	1
35	44	หฟก	120.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1759610312/food-menu/ucs9yjsd4lwn8hypduii.jpg	2025-10-05 03:38:32.884743	[{"label": "2", "extraPrice": 20}]	\N	144.00	[{"name": "2", "extraPrice": 24}]	1	1
36	44	a	2.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1759612682/food-menu/yxcof5fuchfdc5tos15x.jpg	2025-10-05 04:18:03.569573	[{"label": "2", "extraPrice": 2}]	\N	3.00	[{"name": "2", "extraPrice": 3}]	2	1
37	44	ขี้คน	50.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1759664329/food-menu/ttbzanfaa5klatuv679v.jpg	2025-10-05 18:38:50.129538	[{"label": "vanila", "extraPrice": 25}, {"label": "S", "extraPrice": 10}]	\N	60.00	[{"name": "vanila", "extraPrice": 30}, {"name": "S", "extraPrice": 12}]	2	15
38	44	s	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1759667836/food-menu/lqssppsxv47oc03xcld3.jpg	2025-10-05 19:37:16.840682	[{"label": "w", "extraPrice": 10}]	\N	24.00	[{"name": "w", "extraPrice": 12}]	1	15
39	45	ฟห	10.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1759684676/food-menu/owhwstijadrl7i7yspbk.jpg	2025-10-06 00:17:57.471406	[{"label": "d1", "extraPrice": 12}]	\N	12.00	[{"name": "d1", "extraPrice": 15}]	2	15
42	37	กาว	20.00	https://res.cloudinary.com/djqdn2zru/image/upload/v1760188358/Market-LOGO/ve0ktipgnondbs0omgmn.jpg	2025-10-11 20:12:39.333346	[{"label": "เมา", "extraPrice": 500}, {"label": "ซอฟ", "extraPrice": 2000}]	\N	23.00	[{"label": "เมา", "extraPrice": 575}, {"label": "ซอฟ", "extraPrice": 2300}]	2	\N
\.


--
-- TOC entry 3726 (class 0 OID 25418)
-- Dependencies: 229
-- Data for Name: market_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.market_reviews (review_id, order_id, user_id, market_id, rating, comment, created_at, updated_at) FROM stdin;
40	260	31	37	4	เเซบ	2025-10-15 16:16:24.713456	2025-10-15 16:16:24.713456
41	261	31	37	4	เร็วดี	2025-10-15 16:29:43.539943	2025-10-15 16:29:43.539943
\.


--
-- TOC entry 3728 (class 0 OID 25427)
-- Dependencies: 231
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.markets (market_id, owner_id, shop_name, shop_description, shop_logo_url, created_at, latitude, longitude, open_time, close_time, is_open, is_manual_override, override_until, rating, address, phone, approve, admin_id, is_admin, reviews_count) FROM stdin;
40	34	สมรักษ์ไง	สวัสดีครับ	https://res.cloudinary.com/djqdn2zru/image/upload/v1758282179/Market-LOGO/x379jxfcblswkbgrcv2y.jpg	2025-09-19 18:43:00.668904	51.93657927318116	-100.27912449091673	04:42	23:59	t	f	\N	\N	ศรีเกต	0984857628	t	1	f	0
44	\N	ซิมเบิ่งเด้อ	ขายอาการตามสั่ง เปิด 18:00 - 05:00 น. อร่อยพร้อมส่ง	https://res.cloudinary.com/djqdn2zru/image/upload/v1759586644/food-menu/ngr6oteprzvu64u9thov.jpg	2025-10-04 21:04:05.394236	17.272637211868073	104.13484127931125	18:00	05:00	t	f	\N	\N	123/9 บ้านเชียงเครือ เชียงเครือ เมือง สกลนคร 47000	0998234657	f	1	t	0
45	\N	หกหก	หก	https://res.cloudinary.com/djqdn2zru/image/upload/v1759682440/food-menu/qe8fm7rg2y1z6bv30yrp.jpg	2025-10-05 23:40:41.440782	17.28934765314215	104.11304434246144	19:09	11:41	t	f	\N	\N	s	0912013123	f	15	t	0
39	36	ร้ายแรงมาก a	ไฟฟ้า a	https://res.cloudinary.com/djqdn2zru/image/upload/v1759827313/Market-LOGO/gdjy3svitexlgayxkgql.png	2025-09-19 18:29:17.243767	17.27891775402024	104.11517959088087	15:54	19:54	f	f	\N	\N	42/6 เชียงเครือ หออะตอม 45801a	0716876464	t	1	f	2
38	\N	ร้านแอดมิน	ร้านแอดมิน เด้อจ่ะ แพงขึ้น 20%	https://res.cloudinary.com/djqdn2zru/image/upload/v1757608039/food-menu/hserelfmmpvtup06j3lb.jpg	2025-09-11 23:27:20.249612	13.736717	100.523186	00:00	07:11	f	f	\N	\N	23/1 เชียงเครือ	-	f	1	t	0
43	35	122	122	https://res.cloudinary.com/djqdn2zru/image/upload/v1758360443/Market-LOGO/s8yir43xu0t8tbzptnj1.jpg	2025-09-20 16:27:25.266129	38.28260714608228	-93.04697670042515	16:26	23:26	t	f	\N	\N	122	122	t	1	f	0
37	31	เสกสายเบิร์น (ย่าง)	ขายไก่ย่าง เนื้อย่าง ปลาเผา ส่งฟรี ส่งไว หอมอร่อย. 🏎️💥	https://res.cloudinary.com/djqdn2zru/image/upload/v1757491128/Market-LOGO/zegkbequ9px72yz8mdkn.jpg	2025-09-10 14:58:49.472311	17.27025890434053	104.13420014083385	14:00	06:50	t	f	\N	4.0	42/6 เชียงเครือ หออะตอม 45801	0987654321	t	\N	f	2
\.


--
-- TOC entry 3730 (class 0 OID 25439)
-- Dependencies: 233
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (item_id, order_id, food_id, food_name, quantity, sell_price, subtotal, selected_options, original_price, original_subtotal, original_options, additional_notes, is_reviewed) FROM stdin;
267	260	18	ลาบ	1	27.00	45.00	[{"label": "หมู", "extraPrice": 18}]	23.00	38.00	[{"label": "หมู", "extraPrice": 15}]		t
268	261	18	ลาบ	1	27.00	39.00	[{"label": "ไก่", "extraPrice": 12}]	23.00	33.00	[{"label": "ไก่", "extraPrice": 10}]		t
270	263	37	ขี้คน	1	60.00	90.00	[{"label": "", "extraPrice": 30}]	50.00	50.00	[]		f
\.


--
-- TOC entry 3732 (class 0 OID 25449)
-- Dependencies: 235
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (order_id, user_id, market_id, rider_id, address, delivery_type, payment_method, note, distance_km, delivery_fee, total_price, status, created_at, updated_at, address_id, rider_required_gp, bonus, original_total_price, shop_status, delivery_photo, is_market_reviewed, is_rider_reviewed) FROM stdin;
260	31	37	10	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	แบบ/วางไว้จุดที่ระบุ	เงินสด		2.39	15.00	60.00	completed	2025-10-15 16:13:09.796264	2025-10-15 16:16:41.398618	7	7.00	0.00	38.00	ready_for_pickup	http://10.28.145.44:4000/uploads/delivery_photos/delivery_1760519709037_nemsnv.jpg	t	t
261	31	37	10	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	แบบ/วางไว้จุดที่ระบุ	เงินสด		2.39	15.00	54.00	completed	2025-10-15 16:25:49.033576	2025-10-15 16:29:56.763913	7	6.00	0.00	33.00	ready_for_pickup	http://10.28.145.44:4000/uploads/delivery_photos/delivery_1760520465934_gt5fgr.jpg	t	t
263	31	44	11	749P+JVJ 749P+JVJ ตำบล เชียงเครือ อำเภอเมืองสกลนคร สกลนคร 47000 ประเทศไทย อ.อำเภอเมืองสกลนคร จ.สกลนคร 47000	แบบ/วางไว้จุดที่ระบุ	เงินสด		3.82	15.00	105.00	rider_assigned	2025-10-15 20:59:22.677191	2025-10-15 23:05:59.380038	7	40.00	0.00	50.00	\N	\N	f	f
\.


--
-- TOC entry 3734 (class 0 OID 25462)
-- Dependencies: 237
-- Data for Name: rider_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_addresses (address_id, user_id, house_number, street, subdistrict, district, province, postal_code, is_default, created_at, updated_at) FROM stdin;
7	35	388	\N	เชียงเครือ	เมือง	สกล	\N	t	2025-09-19 12:40:32.191355	2025-09-19 12:40:32.191355
8	45	t	\N	กะเฉด	เมืองระยอง	ระยอง	\N	t	2025-10-15 19:20:48.328898	2025-10-15 19:20:48.328898
\.


--
-- TOC entry 3736 (class 0 OID 25471)
-- Dependencies: 239
-- Data for Name: rider_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_profiles (rider_id, user_id, id_card_number, id_card_photo_url, id_card_selfie_url, driving_license_number, driving_license_photo_url, vehicle_type, vehicle_brand_model, vehicle_color, vehicle_photo_url, vehicle_registration_photo_url, approval_status, approved_by, approved_at, rejection_reason, created_at, updated_at, vehicle_registration_number, vehicle_registration_province, promptpay, gp_balance, rating, reviews_count) FROM stdin;
10	35	9901700123459	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260702/rider-documents/ppufc7us313g6qem5zkp.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260701/rider-documents/hphwpjueczxwksykhlmr.png	DL1234568	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260703/rider-documents/n6ycoqgi3oz0wy3db1cj.png	motorcycle	Honda Wave	Red	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260704/rider-documents/qslldgochuknpxqns2hn.png	https://res.cloudinary.com/djqdn2zru/image/upload/v1758260705/rider-documents/itjr5smgaraqqtadtlzb.png	approved	1	\N	\N	2025-09-19 12:44:59.694794	2025-10-15 16:29:56.763913	ฟก-123	สกลนคร	1234556789012	5875.00	4.5	2
11	45	1560528864554	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530956/rider-documents/i7fitnarwwldd3zxv7zn.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530955/rider-documents/qmebayouuhdu7gfuvnjt.jpg	12356788	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530957/rider-documents/ajjpa2tveycyxnvmky9k.jpg	motorcycle	hcjcfu	red	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530959/rider-documents/ikedac3ptle9rzap78cp.jpg	https://res.cloudinary.com/djqdn2zru/image/upload/v1760530960/rider-documents/cuuzoncicyrqixvdnglu.jpg	approved	1	2025-10-15 19:42:04.201079	\N	2025-10-15 19:22:33.223371	2025-10-15 23:05:59.380038	yyy	ggg	0989520103	128.00	\N	0
\.


--
-- TOC entry 3738 (class 0 OID 25487)
-- Dependencies: 241
-- Data for Name: rider_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_reviews (review_id, order_id, user_id, rider_id, rating, comment, created_at, updated_at) FROM stdin;
23	260	31	10	5	เร็วไปเเรงจริง	2025-10-15 16:16:41.398618	2025-10-15 16:16:41.398618
24	261	31	10	4	ค้อน	2025-10-15 16:29:56.763913	2025-10-15 16:29:56.763913
\.


--
-- TOC entry 3740 (class 0 OID 25496)
-- Dependencies: 243
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
\.


--
-- TOC entry 3749 (class 0 OID 26080)
-- Dependencies: 252
-- Data for Name: shop_closed_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shop_closed_reports (report_id, order_id, market_id, rider_id, reason, note, image_urls, status, reviewed_by, reviewed_at, created_at, updated_at) FROM stdin;
10	\N	40	10	โทรไม่ติด / ไม่มีคนรับสาย	\N	{}	pending	\N	\N	2025-10-14 20:57:19.06891	2025-10-14 20:57:19.06891
13	\N	40	10	ร้านย้ายที่ตั้ง	ร้านปิดสัส	{http://10.164.109.44:4000/uploads/shop_closed/shopclosed_1760450675948_499915471.jpg}	checked	\N	2025-10-14 21:55:23.695013	2025-10-14 21:04:35.984919	2025-10-14 21:55:23.695013
8	\N	39	10	ร้านปิดชั่วคราว	ไม่มีคนอยู่ในร้าน	{http://0.0.0.0:4000/uploads/shop_closed/shopclosed_1760438349626_724130693.jpeg,http://0.0.0.0:4000/uploads/shop_closed/shopclosed_1760438349627_352237942.jpeg}	pending	\N	\N	2025-10-14 17:39:09.635337	2025-10-14 17:39:09.635337
12	\N	43	10	ร้านปิดชั่วคราว	\N	{}	pending	\N	2025-10-14 22:12:31.219977	2025-10-14 21:02:42.031228	2025-10-14 22:12:31.219977
14	\N	45	10	ร้านไม่อยู่ในพื้นที่	\N	{http://10.164.109.44:4000/uploads/shop_closed/shopclosed_1760455696628_523435492.jpg,http://10.164.109.44:4000/uploads/shop_closed/shopclosed_1760455696646_491273531.jpg}	pending	\N	\N	2025-10-14 22:28:17.039717	2025-10-14 22:28:17.039717
\.


--
-- TOC entry 3742 (class 0 OID 25506)
-- Dependencies: 245
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
\.


--
-- TOC entry 3796 (class 0 OID 0)
-- Dependencies: 216
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 15, true);


--
-- TOC entry 3797 (class 0 OID 0)
-- Dependencies: 218
-- Name: carts_cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carts_cart_id_seq', 311, true);


--
-- TOC entry 3798 (class 0 OID 0)
-- Dependencies: 220
-- Name: categorys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorys_id_seq', 3, true);


--
-- TOC entry 3799 (class 0 OID 0)
-- Dependencies: 222
-- Name: chat_messages_message_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_messages_message_id_seq', 112, true);


--
-- TOC entry 3800 (class 0 OID 0)
-- Dependencies: 224
-- Name: chat_rooms_room_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_rooms_room_id_seq', 28, true);


--
-- TOC entry 3801 (class 0 OID 0)
-- Dependencies: 226
-- Name: client_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.client_addresses_id_seq', 13, true);


--
-- TOC entry 3802 (class 0 OID 0)
-- Dependencies: 249
-- Name: complaints_complaint_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.complaints_complaint_id_seq', 3, true);


--
-- TOC entry 3803 (class 0 OID 0)
-- Dependencies: 247
-- Name: food_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.food_reviews_review_id_seq', 37, true);


--
-- TOC entry 3804 (class 0 OID 0)
-- Dependencies: 228
-- Name: foods_food_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.foods_food_id_seq', 42, true);


--
-- TOC entry 3805 (class 0 OID 0)
-- Dependencies: 230
-- Name: market_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.market_reviews_review_id_seq', 41, true);


--
-- TOC entry 3806 (class 0 OID 0)
-- Dependencies: 232
-- Name: markets_market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.markets_market_id_seq', 45, true);


--
-- TOC entry 3807 (class 0 OID 0)
-- Dependencies: 234
-- Name: order_items_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_item_id_seq', 270, true);


--
-- TOC entry 3808 (class 0 OID 0)
-- Dependencies: 236
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 263, true);


--
-- TOC entry 3809 (class 0 OID 0)
-- Dependencies: 238
-- Name: rider_addresses_address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_addresses_address_id_seq', 8, true);


--
-- TOC entry 3810 (class 0 OID 0)
-- Dependencies: 240
-- Name: rider_profiles_rider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_profiles_rider_id_seq', 11, true);


--
-- TOC entry 3811 (class 0 OID 0)
-- Dependencies: 242
-- Name: rider_reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_reviews_review_id_seq', 24, true);


--
-- TOC entry 3812 (class 0 OID 0)
-- Dependencies: 244
-- Name: rider_topups_topup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rider_topups_topup_id_seq', 12, true);


--
-- TOC entry 3813 (class 0 OID 0)
-- Dependencies: 251
-- Name: shop_closed_reports_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shop_closed_reports_report_id_seq', 14, true);


--
-- TOC entry 3814 (class 0 OID 0)
-- Dependencies: 246
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 45, true);


--
-- TOC entry 3439 (class 2606 OID 25533)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 3441 (class 2606 OID 25535)
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- TOC entry 3443 (class 2606 OID 25537)
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (cart_id);


--
-- TOC entry 3445 (class 2606 OID 25539)
-- Name: categorys categorys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorys
    ADD CONSTRAINT categorys_pkey PRIMARY KEY (id);


--
-- TOC entry 3447 (class 2606 OID 25541)
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (message_id);


--
-- TOC entry 3451 (class 2606 OID 25543)
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (room_id);


--
-- TOC entry 3458 (class 2606 OID 25545)
-- Name: client_addresses client_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_addresses
    ADD CONSTRAINT client_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 3520 (class 2606 OID 25802)
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (complaint_id);


--
-- TOC entry 3516 (class 2606 OID 25764)
-- Name: food_reviews food_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT food_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 3460 (class 2606 OID 25547)
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (food_id);


--
-- TOC entry 3464 (class 2606 OID 25549)
-- Name: market_reviews market_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 3468 (class 2606 OID 25551)
-- Name: markets markets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_pkey PRIMARY KEY (market_id);


--
-- TOC entry 3471 (class 2606 OID 25553)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (item_id);


--
-- TOC entry 3476 (class 2606 OID 25555)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 3481 (class 2606 OID 25557)
-- Name: rider_addresses rider_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT rider_addresses_pkey PRIMARY KEY (address_id);


--
-- TOC entry 3490 (class 2606 OID 25559)
-- Name: rider_profiles rider_profiles_driving_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_driving_license_number_key UNIQUE (driving_license_number);


--
-- TOC entry 3492 (class 2606 OID 25561)
-- Name: rider_profiles rider_profiles_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_id_card_number_key UNIQUE (id_card_number);


--
-- TOC entry 3494 (class 2606 OID 25563)
-- Name: rider_profiles rider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_pkey PRIMARY KEY (rider_id);


--
-- TOC entry 3496 (class 2606 OID 25565)
-- Name: rider_profiles rider_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT rider_profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 3502 (class 2606 OID 25567)
-- Name: rider_reviews rider_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_pkey PRIMARY KEY (review_id);


--
-- TOC entry 3510 (class 2606 OID 25569)
-- Name: rider_topups rider_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_pkey PRIMARY KEY (topup_id);


--
-- TOC entry 3522 (class 2606 OID 26091)
-- Name: shop_closed_reports shop_closed_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_pkey PRIMARY KEY (report_id);


--
-- TOC entry 3518 (class 2606 OID 25791)
-- Name: food_reviews unique_food_review_per_item; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT unique_food_review_per_item UNIQUE (order_item_id, user_id);


--
-- TOC entry 3498 (class 2606 OID 25571)
-- Name: rider_profiles unique_vehicle_registration; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT unique_vehicle_registration UNIQUE (vehicle_registration_number, vehicle_registration_province);


--
-- TOC entry 3456 (class 2606 OID 25573)
-- Name: chat_rooms uq_chat_room_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT uq_chat_room_order UNIQUE (order_id);


--
-- TOC entry 3466 (class 2606 OID 25575)
-- Name: market_reviews uq_market_review_per_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT uq_market_review_per_order UNIQUE (order_id);


--
-- TOC entry 3504 (class 2606 OID 25577)
-- Name: rider_reviews uq_rider_review_per_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT uq_rider_review_per_order UNIQUE (order_id);


--
-- TOC entry 3512 (class 2606 OID 25579)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3514 (class 2606 OID 25581)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3448 (class 1259 OID 25582)
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);


--
-- TOC entry 3449 (class 1259 OID 25583)
-- Name: idx_chat_messages_room_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_room_id ON public.chat_messages USING btree (room_id);


--
-- TOC entry 3452 (class 1259 OID 25584)
-- Name: idx_chat_rooms_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_customer_id ON public.chat_rooms USING btree (customer_id);


--
-- TOC entry 3453 (class 1259 OID 25585)
-- Name: idx_chat_rooms_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_order_id ON public.chat_rooms USING btree (order_id);


--
-- TOC entry 3454 (class 1259 OID 25586)
-- Name: idx_chat_rooms_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_rider_id ON public.chat_rooms USING btree (rider_id);


--
-- TOC entry 3461 (class 1259 OID 25587)
-- Name: idx_market_reviews_market_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_reviews_market_id ON public.market_reviews USING btree (market_id);


--
-- TOC entry 3462 (class 1259 OID 25588)
-- Name: idx_market_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_reviews_user_id ON public.market_reviews USING btree (user_id);


--
-- TOC entry 3469 (class 1259 OID 25589)
-- Name: idx_order_items_original_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_original_price ON public.order_items USING btree (original_price);


--
-- TOC entry 3472 (class 1259 OID 25590)
-- Name: idx_orders_market_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_market_status_created ON public.orders USING btree (market_id, status, created_at);


--
-- TOC entry 3473 (class 1259 OID 25591)
-- Name: idx_orders_original_total_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_original_total_price ON public.orders USING btree (original_total_price);


--
-- TOC entry 3474 (class 1259 OID 25592)
-- Name: idx_orders_shop_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_shop_status ON public.orders USING btree (shop_status);


--
-- TOC entry 3477 (class 1259 OID 25593)
-- Name: idx_rider_addresses_district; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_district ON public.rider_addresses USING btree (district, province);


--
-- TOC entry 3478 (class 1259 OID 25594)
-- Name: idx_rider_addresses_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_province ON public.rider_addresses USING btree (province);


--
-- TOC entry 3479 (class 1259 OID 25595)
-- Name: idx_rider_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_addresses_user_id ON public.rider_addresses USING btree (user_id);


--
-- TOC entry 3482 (class 1259 OID 25596)
-- Name: idx_rider_profiles_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_approval_status ON public.rider_profiles USING btree (approval_status);


--
-- TOC entry 3483 (class 1259 OID 25597)
-- Name: idx_rider_profiles_driving_license_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_driving_license_number ON public.rider_profiles USING btree (driving_license_number);


--
-- TOC entry 3484 (class 1259 OID 25598)
-- Name: idx_rider_profiles_id_card_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_id_card_number ON public.rider_profiles USING btree (id_card_number);


--
-- TOC entry 3485 (class 1259 OID 25599)
-- Name: idx_rider_profiles_promptpay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_promptpay ON public.rider_profiles USING btree (promptpay);


--
-- TOC entry 3486 (class 1259 OID 25600)
-- Name: idx_rider_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_user_id ON public.rider_profiles USING btree (user_id);


--
-- TOC entry 3487 (class 1259 OID 25601)
-- Name: idx_rider_profiles_vehicle_province; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles USING btree (vehicle_registration_province);


--
-- TOC entry 3488 (class 1259 OID 25602)
-- Name: idx_rider_profiles_vehicle_registration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles USING btree (vehicle_registration_number);


--
-- TOC entry 3499 (class 1259 OID 25603)
-- Name: idx_rider_reviews_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_reviews_rider_id ON public.rider_reviews USING btree (rider_id);


--
-- TOC entry 3500 (class 1259 OID 25604)
-- Name: idx_rider_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_reviews_user_id ON public.rider_reviews USING btree (user_id);


--
-- TOC entry 3505 (class 1259 OID 25605)
-- Name: idx_rider_topups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_created_at ON public.rider_topups USING btree (created_at);


--
-- TOC entry 3506 (class 1259 OID 25606)
-- Name: idx_rider_topups_rider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_rider_id ON public.rider_topups USING btree (rider_id);


--
-- TOC entry 3507 (class 1259 OID 25607)
-- Name: idx_rider_topups_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_status ON public.rider_topups USING btree (status);


--
-- TOC entry 3508 (class 1259 OID 25608)
-- Name: idx_rider_topups_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_topups_user_id ON public.rider_topups USING btree (user_id);


--
-- TOC entry 3563 (class 2620 OID 25609)
-- Name: market_reviews trg_market_reviews_aiud; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_market_reviews_aiud AFTER INSERT OR DELETE OR UPDATE ON public.market_reviews FOR EACH ROW EXECUTE FUNCTION public._after_market_review_change();


--
-- TOC entry 3567 (class 2620 OID 25610)
-- Name: rider_reviews trg_rider_reviews_aiud; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_rider_reviews_aiud AFTER INSERT OR DELETE OR UPDATE ON public.rider_reviews FOR EACH ROW EXECUTE FUNCTION public._after_rider_review_change();


--
-- TOC entry 3564 (class 2620 OID 25611)
-- Name: market_reviews trg_validate_market_review; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_market_review BEFORE INSERT OR UPDATE ON public.market_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_market_review();


--
-- TOC entry 3568 (class 2620 OID 25612)
-- Name: rider_reviews trg_validate_rider_review; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_rider_review BEFORE INSERT OR UPDATE ON public.rider_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_rider_review();


--
-- TOC entry 3562 (class 2620 OID 25613)
-- Name: chat_rooms update_chat_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3565 (class 2620 OID 25614)
-- Name: rider_addresses update_rider_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_addresses_updated_at BEFORE UPDATE ON public.rider_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3566 (class 2620 OID 25615)
-- Name: rider_profiles update_rider_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3523 (class 2606 OID 25616)
-- Name: carts carts_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 3524 (class 2606 OID 25621)
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3525 (class 2606 OID 25626)
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE;


--
-- TOC entry 3526 (class 2606 OID 25631)
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3527 (class 2606 OID 25636)
-- Name: chat_rooms chat_rooms_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3528 (class 2606 OID 25641)
-- Name: chat_rooms chat_rooms_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3529 (class 2606 OID 25646)
-- Name: chat_rooms chat_rooms_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE CASCADE;


--
-- TOC entry 3555 (class 2606 OID 25813)
-- Name: complaints complaints_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE SET NULL;


--
-- TOC entry 3556 (class 2606 OID 25808)
-- Name: complaints complaints_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE SET NULL;


--
-- TOC entry 3557 (class 2606 OID 25803)
-- Name: complaints complaints_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 3539 (class 2606 OID 25651)
-- Name: orders fk_address; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_address FOREIGN KEY (address_id) REFERENCES public.client_addresses(id);


--
-- TOC entry 3535 (class 2606 OID 25656)
-- Name: markets fk_admin; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 3550 (class 2606 OID 25780)
-- Name: food_reviews fk_food_reviews_food; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_food FOREIGN KEY (food_id) REFERENCES public.foods(food_id) ON DELETE CASCADE;


--
-- TOC entry 3551 (class 2606 OID 25775)
-- Name: food_reviews fk_food_reviews_market; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_market FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3552 (class 2606 OID 25765)
-- Name: food_reviews fk_food_reviews_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_order FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3553 (class 2606 OID 25770)
-- Name: food_reviews fk_food_reviews_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT fk_food_reviews_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3541 (class 2606 OID 25661)
-- Name: rider_addresses fk_rider_addresses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_addresses
    ADD CONSTRAINT fk_rider_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3542 (class 2606 OID 25666)
-- Name: rider_profiles fk_rider_profiles_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES public.admins(id);


--
-- TOC entry 3543 (class 2606 OID 25671)
-- Name: rider_profiles fk_rider_profiles_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_profiles
    ADD CONSTRAINT fk_rider_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3554 (class 2606 OID 25785)
-- Name: food_reviews food_reviews_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_reviews
    ADD CONSTRAINT food_reviews_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(item_id) ON DELETE CASCADE;


--
-- TOC entry 3530 (class 2606 OID 25746)
-- Name: foods foods_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categorys(id);


--
-- TOC entry 3531 (class 2606 OID 25676)
-- Name: foods foods_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3532 (class 2606 OID 25681)
-- Name: market_reviews market_reviews_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE CASCADE;


--
-- TOC entry 3533 (class 2606 OID 25686)
-- Name: market_reviews market_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3534 (class 2606 OID 25691)
-- Name: market_reviews market_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_reviews
    ADD CONSTRAINT market_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3536 (class 2606 OID 25696)
-- Name: markets markets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.markets
    ADD CONSTRAINT markets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


--
-- TOC entry 3537 (class 2606 OID 25701)
-- Name: order_items order_items_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(food_id);


--
-- TOC entry 3538 (class 2606 OID 25706)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3540 (class 2606 OID 25711)
-- Name: orders orders_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id);


--
-- TOC entry 3544 (class 2606 OID 25716)
-- Name: rider_reviews rider_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3545 (class 2606 OID 25721)
-- Name: rider_reviews rider_reviews_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE CASCADE;


--
-- TOC entry 3546 (class 2606 OID 25726)
-- Name: rider_reviews rider_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_reviews
    ADD CONSTRAINT rider_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3547 (class 2606 OID 25731)
-- Name: rider_topups rider_topups_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- TOC entry 3548 (class 2606 OID 25736)
-- Name: rider_topups rider_topups_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id);


--
-- TOC entry 3549 (class 2606 OID 25741)
-- Name: rider_topups rider_topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_topups
    ADD CONSTRAINT rider_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3558 (class 2606 OID 26097)
-- Name: shop_closed_reports shop_closed_reports_market_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(market_id) ON DELETE SET NULL;


--
-- TOC entry 3559 (class 2606 OID 26092)
-- Name: shop_closed_reports shop_closed_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE SET NULL;


--
-- TOC entry 3560 (class 2606 OID 26107)
-- Name: shop_closed_reports shop_closed_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.admins(id) ON DELETE SET NULL;


--
-- TOC entry 3561 (class 2606 OID 26102)
-- Name: shop_closed_reports shop_closed_reports_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_closed_reports
    ADD CONSTRAINT shop_closed_reports_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(rider_id) ON DELETE SET NULL;


-- Completed on 2025-10-15 23:08:32 +07

--
-- PostgreSQL database dump complete
--

\unrestrict VWLxW5Adc7OxaNcOj3NP2jKrXuuHKCPoNyp5KzVXumSYc86uJE1qGBLe866dpEf

