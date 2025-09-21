-- 1) เสริมคอลัมน์สรุปในตารางสรุป
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

-- 2) ตารางรีวิวร้าน (market) — ผูกกับออเดอร์ + ยูสเซอร์ + ร้าน
-- หมายเหตุ: ถ้าเป็น PG ≥ 10 แนะนำใช้ GENERATED AS IDENTITY แทน serial
CREATE TABLE IF NOT EXISTS public.market_reviews (
  review_id      serial PRIMARY KEY,
  order_id       integer NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  user_id        integer NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  market_id      integer NOT NULL REFERENCES public.markets(market_id) ON DELETE CASCADE,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text,
  created_at     timestamp without time zone NOT NULL DEFAULT now(),
  updated_at     timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_market_review_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_market_reviews_market_id ON public.market_reviews(market_id);
CREATE INDEX IF NOT EXISTS idx_market_reviews_user_id   ON public.market_reviews(user_id);

-- 3) ตารางรีวิวไรเดอร์ — ผูกกับออเดอร์ + ยูสเซอร์ + ไรเดอร์
CREATE TABLE IF NOT EXISTS public.rider_reviews (
  review_id      serial PRIMARY KEY,
  order_id       integer NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  user_id        integer NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  rider_id       integer NOT NULL REFERENCES public.rider_profiles(rider_id) ON DELETE CASCADE,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text,
  created_at     timestamp without time zone NOT NULL DEFAULT now(),
  updated_at     timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_rider_review_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_rider_reviews_rider_id ON public.rider_reviews(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_reviews_user_id  ON public.rider_reviews(user_id);

-- 4) ฟังก์ชัน validate: ตรวจสิทธิ์รีวิว + ตรวจสถานะออเดอร์
CREATE OR REPLACE FUNCTION public.validate_market_review() RETURNS trigger AS $$
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

  -- สถานะต้อง delivered
  IF o.status <> 'delivered' THEN
    RAISE EXCEPTION 'Order % is not delivered (status=%).', NEW.order_id, o.status;
  END IF;

  -- market_id ต้องตรงกับออเดอร์
  IF o.market_id IS NULL OR o.market_id <> NEW.market_id THEN
    RAISE EXCEPTION 'market_id mismatch for order %', NEW.order_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validate_market_review
BEFORE INSERT OR UPDATE ON public.market_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_market_review();


CREATE OR REPLACE FUNCTION public.validate_rider_review() RETURNS trigger AS $$
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

  -- สถานะต้อง delivered
  IF o.status <> 'delivered' THEN
    RAISE EXCEPTION 'Order % is not delivered (status=%).', NEW.order_id, o.status;
  END IF;

  -- ต้องมี rider_id ในออเดอร์ และตรงกัน
  IF o.rider_id IS NULL OR o.rider_id <> NEW.rider_id THEN
    RAISE EXCEPTION 'No rider assigned or rider mismatch for order %', NEW.order_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validate_rider_review
BEFORE INSERT OR UPDATE ON public.rider_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_rider_review();

-- 5) ฟังก์ชันสรุปค่าเฉลี่ย/นับจำนวน และทริกเกอร์อัปเดตหลังมีรีวิว
CREATE OR REPLACE FUNCTION public.recompute_market_rating(p_market_id integer) RETURNS void AS $$
BEGIN
  UPDATE public.markets m
  SET
    rating = COALESCE(ROUND( (SELECT AVG(r.rating)::numeric FROM public.market_reviews r WHERE r.market_id = p_market_id ), 1), 0),
    reviews_count = (SELECT CAST(COUNT(*) AS integer) FROM public.market_reviews r WHERE r.market_id = p_market_id)
  WHERE m.market_id = p_market_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.recompute_rider_rating(p_rider_id integer) RETURNS void AS $$
BEGIN
  UPDATE public.rider_profiles r
  SET
    rating = COALESCE(ROUND( (SELECT AVG(rv.rating)::numeric FROM public.rider_reviews rv WHERE rv.rider_id = p_rider_id ), 1), 0),
    reviews_count = (SELECT CAST(COUNT(*) AS integer) FROM public.rider_reviews rv WHERE rv.rider_id = p_rider_id)
  WHERE r.rider_id = p_rider_id;
END;
$$ LANGUAGE plpgsql;

-- ทริกเกอร์ฝั่งร้าน
CREATE OR REPLACE FUNCTION public._after_market_review_change() RETURNS trigger AS $$
BEGIN
  PERFORM public.recompute_market_rating( CASE WHEN TG_OP='DELETE' THEN OLD.market_id ELSE NEW.market_id END );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_market_reviews_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.market_reviews
FOR EACH ROW EXECUTE FUNCTION public._after_market_review_change();

-- ทริกเกอร์ฝั่งไรเดอร์
CREATE OR REPLACE FUNCTION public._after_rider_review_change() RETURNS trigger AS $$
BEGIN
  PERFORM public.recompute_rider_rating( CASE WHEN TG_OP='DELETE' THEN OLD.rider_id ELSE NEW.rider_id END );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_rider_reviews_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.rider_reviews
FOR EACH ROW EXECUTE FUNCTION public._after_rider_review_change();
