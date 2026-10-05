import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { useLogin } from '../../features/auth/hooks';

import {
  loginSchema,
  type LoginFormValues,
} from '../../features/auth/schemas';

import { ApiError } from '../../services/apiClient';
import { ROLE_HOME } from '../../lib/roles';
import { decodeAccessToken } from '../../lib/jwt';
import { useAuthStore } from '../../lib/authStore';
import { cn } from '../../lib/utils';

import { Button } from '../../components/common/Button';

const LOGO_SRC = '/egode_logo.png';

export default function LoginPage() {
  const navigate = useNavigate();

  const location = useLocation() as {
    state?: {
      from?: {
        pathname?: string;
        search?: string;
      };
    };
  };

  const loginMutation = useLogin();

  const [showSessionExpired] = useState(
    () => useAuthStore.getState().sessionExpired
  );

  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    useAuthStore
      .getState()
      .acknowledgeSessionExpired();
  }, []);

  const {
    register,
    handleSubmit,

    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (
    data: LoginFormValues
  ) => {
    try {
      const result =
        await loginMutation.mutateAsync(data);

      const decoded =
        decodeAccessToken(
          result.accessToken
        );

      const fallback =
        (decoded &&
          ROLE_HOME[decoded.role]) ||
        '/';

      const returnTo =
        location.state?.from;

      navigate(
        returnTo?.pathname
          ? `${returnTo.pathname}${
              returnTo.search ?? ''
            }`
          : fallback,
        {
          replace: true,
        }
      );
    } catch {
      // Error displayed below
    }
  };

  const busy =
    isSubmitting ||
    loginMutation.isPending;

  const inputClass = (
    hasError?: boolean
  ) =>
    cn(
      `
        h-[54px]
        w-full
        rounded-[14px]
        border
        bg-white
        py-0
        text-[14px]
        font-medium
        leading-none
        text-slate-800
        outline-none

        transition-all
        duration-200

        placeholder:font-normal
        placeholder:text-slate-400

        hover:border-slate-300

        focus:border-blue-500
        focus:ring-4
        focus:ring-blue-500/10
      `,
      hasError
        ? `
            border-red-400
            bg-red-50/30
          `
        : `
            border-slate-200
          `
    );

  return (
    <div
      className="
        relative
        isolate
        min-h-[calc(100vh-var(--header-height))]
        overflow-hidden
        bg-slate-950
        bg-cover
        bg-center
        bg-no-repeat
      "
      style={{
        backgroundImage:
          "url('/login_bg.jpg')",

        fontFamily:
          '"Be Vietnam Pro", sans-serif',
      }}
    >
      {/* ==========================
          BACKGROUND
      ========================== */}

      <div
        className="
          absolute
          inset-0
          -z-10

          bg-gradient-to-r

          from-slate-950/80
          via-slate-950/42
          to-slate-900/5
        "
      />

      <div
        className="
          absolute
          inset-x-0
          bottom-0
          -z-10
          h-[55%]

          bg-gradient-to-t
          from-slate-950/55
          via-slate-950/15
          to-transparent
        "
      />

      {/* Blue glow */}

      <div
        className="
          pointer-events-none
          absolute
          -left-40
          top-[22%]
          -z-10

          h-[500px]
          w-[500px]

          rounded-full

          bg-cyan-400/10

          blur-[130px]
        "
      />

      {/* ==========================
          PAGE
      ========================== */}

      <div
        className="
          mx-auto

          flex

          min-h-[calc(100vh-var(--header-height))]

          w-full
          max-w-[1500px]

          items-center

          px-6
          py-8

          lg:px-12

          xl:px-16
        "
      >
        <div
          className="
            grid
            w-full
            items-center

            gap-10

            lg:grid-cols-[minmax(0,1.15fr)_minmax(430px,520px)]

            xl:gap-20
          "
        >

          {/* ==========================================
              LEFT
          ========================================== */}

          <section
            className="
              hidden
              lg:block
            "
          >
            <div className="max-w-[760px]">

              {/* Mini badge */}

              <div
                className="
                  mb-7

                  inline-flex
                  items-center
                  gap-2.5

                  rounded-full

                  border
                  border-white/20

                  bg-slate-950/35

                  px-5
                  py-2.5

                  text-[14px]
                  font-semibold

                  text-slate-100

                  shadow-lg

                  backdrop-blur-md
                "
              >
                <i
                  className="
                    ph
                    ph-map-pin

                    text-[19px]
                    text-cyan-300
                  "
                  aria-hidden="true"
                />

                Đặt phòng dễ dàng cùng Egode
              </div>

              {/* MAIN HEADLINE */}

              <h1
                className="
                  max-w-[720px]

                  text-[clamp(3rem,4.3vw,4.65rem)]

                  font-extrabold

                  leading-[1.12]

                  tracking-[-0.045em]
                "
                style={{
                  color: '#ffffff',

                  textShadow:
                    '0 4px 18px rgba(0,0,0,0.55)',
                }}
              >
                <span
                  className="
                    block
                    !text-white
                  "
                >
                  Chào mừng trở lại
                </span>

                <span
                  className="
                    mt-2
                    block

                    bg-gradient-to-r
                    from-cyan-300
                    via-sky-300
                    to-blue-400

                    bg-clip-text

                    !text-transparent

                    drop-shadow-[0_4px_12px_rgba(14,165,233,0.25)]
                  "
                >
                  cùng Egode.
                </span>
              </h1>

              {/* decorative line */}

              <div
                className="
                  relative

                  mt-6

                  h-[4px]
                  w-[150px]

                  overflow-hidden

                  rounded-full

                  bg-white/15
                "
              >
                <div
                  className="
                    absolute
                    inset-y-0
                    left-0

                    w-[80%]

                    rounded-full

                    bg-gradient-to-r
                    from-cyan-300
                    to-blue-500

                    shadow-[0_0_18px_rgba(56,189,248,0.85)]
                  "
                />
              </div>

              {/* DESCRIPTION */}

              <p
                className="
                  mt-6

                  max-w-[670px]

                  text-[16px]

                  font-medium

                  leading-[1.9]

                  !text-white
                "
                style={{
                  textShadow:
                    '0 2px 8px rgba(0,0,0,0.75)',
                }}
              >
                Đăng nhập để tiếp tục tìm kiếm
                khách sạn, quản lý chuyến đi và
                hoàn tất những kỳ nghỉ bạn đang
                lên kế hoạch.
              </p>

              {/* ======================================
                  FEATURE CARDS
              ====================================== */}

              <div
                className="
                  mt-9

                  grid

                  max-w-[720px]

                  grid-cols-3

                  gap-4
                "
              >
                <LoginFeatureCard
                  icon="ph-map-pin"
                  title="Khám phá"
                  description="Tìm kiếm điểm đến và khách sạn phù hợp."
                />

                <LoginFeatureCard
                  icon="ph-shield-check"
                  title="An tâm"
                  description="Thông tin tài khoản của bạn được bảo vệ."
                />

                <LoginFeatureCard
                  icon="ph-lightning"
                  title="Nhanh chóng"
                  description="Tiếp tục đặt phòng chỉ trong vài bước."
                />
              </div>

            </div>
          </section>

          {/* ==========================================
              RIGHT
          ========================================== */}

          <div
            className="
              flex
              w-full

              justify-center

              lg:justify-end
            "
          >
            <section
              className="
                w-full
                max-w-[510px]

                rounded-[30px]

                border
                border-white/70

                bg-white/95

                px-8
                py-9

                shadow-[0_30px_100px_rgba(15,23,42,0.38)]

                backdrop-blur-xl

                sm:px-10
              "
            >

              {/* ======================================
                  HEADER
              ====================================== */}

              <header
                className="
                  mb-9

                  flex
                  flex-col

                  items-center

                  text-center
                "
              >

                {/* LOGO */}

                <div
                  className="
                    mb-6

                    flex
                    h-[66px]

                    items-center
                    justify-center
                  "
                >
                  <img
                    src={LOGO_SRC}
                    alt="Egode"

                    className="
                      h-[60px]
                      w-auto

                      object-contain

                      drop-shadow-[0_5px_10px_rgba(37,99,235,0.15)]
                    "
                  />
                </div>

                {/* TITLE */}

                <h2
                  className="
                    !m-0

                    bg-gradient-to-r
                    from-slate-900
                    via-blue-900
                    to-blue-600

                    bg-clip-text

                    text-[31px]

                    font-extrabold

                    leading-[1.3]

                    tracking-[-0.035em]

                    !text-transparent
                  "
                >
                  Đăng nhập
                </h2>

                {/* SUBTITLE */}

                <p
                  className="
                    mx-auto
                    mt-3

                    max-w-[365px]

                    text-[14px]

                    font-normal

                    leading-6

                    !text-slate-500
                  "
                >
                  Chào mừng bạn quay lại.
                  Đăng nhập để tiếp tục trải nghiệm{' '}
                  <span
                    className="
                      font-semibold
                      text-blue-600
                    "
                  >
                    cùng Egode.
                  </span>
                </p>
              </header>

              {/* SESSION EXPIRED */}

              {showSessionExpired &&
                !loginMutation.isError && (
                  <div
                    role="alert"

                    className="
                      mb-5

                      flex
                      items-start

                      gap-2.5

                      rounded-xl

                      border
                      border-amber-200

                      bg-amber-50

                      px-4
                      py-3

                      text-sm
                      font-medium

                      text-amber-800
                    "
                  >
                    <i
                      className="
                        ph-fill
                        ph-warning-circle

                        mt-0.5

                        shrink-0

                        text-lg
                      "
                      aria-hidden="true"
                    />

                    <span>
                      Phiên đăng nhập đã hết hạn.
                      Vui lòng đăng nhập lại.
                    </span>
                  </div>
                )}

              {/* LOGIN ERROR */}

              {loginMutation.isError && (
                <div
                  role="alert"

                  className="
                    mb-5

                    flex
                    items-start

                    gap-2.5

                    rounded-xl

                    border
                    border-red-200

                    bg-red-50

                    px-4
                    py-3

                    text-sm
                    font-medium

                    text-red-700
                  "
                >
                  <i
                    className="
                      ph-fill
                      ph-warning-circle

                      mt-0.5

                      shrink-0

                      text-lg
                    "
                    aria-hidden="true"
                  />

                  <span>
                    {loginMutation.error
                      instanceof ApiError
                      ? loginMutation.error.message
                      : 'Đăng nhập thất bại, vui lòng thử lại'}
                  </span>
                </div>
              )}

              {/* ======================================
                  FORM
              ====================================== */}

              <form
                onSubmit={
                  handleSubmit(onSubmit)
                }

                className="space-y-5"

                noValidate
              >

                {/* USERNAME */}

                <div>
                  <label
                    htmlFor="identifier"

                    className="
                      mb-2

                      block

                      text-[13px]

                      font-bold

                      leading-5

                      !text-slate-700
                    "
                  >
                    Email hoặc tên đăng nhập

                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">

                    <i
                      className="
                        ph
                        ph-user

                        pointer-events-none

                        absolute

                        left-4
                        top-1/2

                        -translate-y-1/2

                        text-[20px]

                        text-slate-400
                      "
                      aria-hidden="true"
                    />

                    <input
                      type="text"

                      id="identifier"

                      placeholder="Email hoặc tên đăng nhập"

                      autoComplete="username"

                      className={cn(
                        inputClass(
                          !!errors.identifier
                        ),
                        'pl-12 pr-4'
                      )}

                      {...register(
                        'identifier'
                      )}
                    />
                  </div>

                  {errors.identifier && (
                    <p
                      className="
                        mt-1.5

                        text-xs

                        font-medium

                        text-red-500
                      "
                    >
                      {
                        errors.identifier
                          .message
                      }
                    </p>
                  )}
                </div>

                {/* PASSWORD */}

                <div>
                  <label
                    htmlFor="MatKhau"

                    className="
                      mb-2

                      block

                      text-[13px]

                      font-bold

                      leading-5

                      !text-slate-700
                    "
                  >
                    Mật khẩu

                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">

                    <i
                      className="
                        ph
                        ph-lock-key

                        pointer-events-none

                        absolute

                        left-4
                        top-1/2

                        -translate-y-1/2

                        text-[19px]

                        text-slate-400
                      "
                      aria-hidden="true"
                    />

                    <input
                      type={
                        showPwd
                          ? 'text'
                          : 'password'
                      }

                      id="MatKhau"

                      placeholder="Nhập mật khẩu"

                      autoComplete="current-password"

                      className={cn(
                        inputClass(
                          !!errors.MatKhau
                        ),
                        'pl-12 pr-12'
                      )}

                      {...register(
                        'MatKhau'
                      )}
                    />

                    <button
                      type="button"

                      onClick={() =>
                        setShowPwd(
                          (value) => !value
                        )
                      }

                      className="
                        absolute

                        right-3
                        top-1/2

                        flex

                        h-8
                        w-8

                        -translate-y-1/2

                        items-center
                        justify-center

                        rounded-lg

                        text-slate-400

                        transition

                        hover:bg-slate-100
                        hover:text-blue-600
                      "

                      aria-label={
                        showPwd
                          ? 'Ẩn mật khẩu'
                          : 'Hiện mật khẩu'
                      }
                    >
                      <i
                        className={cn(
                          'ph text-lg',

                          showPwd
                            ? 'ph-eye'
                            : 'ph-eye-slash'
                        )}
                      />
                    </button>

                  </div>

                  {errors.MatKhau && (
                    <p
                      className="
                        mt-1.5

                        text-xs

                        font-medium

                        text-red-500
                      "
                    >
                      {
                        errors.MatKhau
                          .message
                      }
                    </p>
                  )}
                </div>

                {/* FORGOT PASSWORD */}

                <div
                  className="
                    flex
                    justify-end
                  "
                >
                  <Link
                    to="/forgot-password"

                    className="
                      text-[13px]

                      font-semibold

                      text-slate-600

                      transition-colors

                      hover:text-blue-600
                    "
                  >
                    Quên mật khẩu?
                  </Link>
                </div>

                {/* LOGIN BUTTON */}

                <Button
                  type="submit"

                  size="lg"

                  disabled={busy}

                  className="
                    min-h-[54px]

                    w-full

                    justify-center

                    rounded-[12px]

                    bg-gradient-to-r
                    from-blue-600
                    to-blue-500

                    text-[15px]

                    font-bold

                    text-white

                    shadow-[0_8px_24px_rgba(37,99,235,0.24)]

                    transition-all

                    duration-200

                    hover:-translate-y-[1px]
                    hover:shadow-[0_12px_30px_rgba(37,99,235,0.32)]
                  "
                >
                  {busy ? (
                    <>
                      Đang xử lý...

                      <span
                        className="
                          spinner

                          h-4
                          w-4

                          border-2

                          border-white/20
                          border-t-white
                        "
                      />
                    </>
                  ) : (
                    <>
                      Đăng nhập

                      <i
                        className="
                          ph
                          ph-arrow-right

                          text-lg
                        "
                      />
                    </>
                  )}
                </Button>

              </form>

              {/* ======================================
                  DIVIDER
              ====================================== */}

              <div
                className="
                  my-7

                  flex
                  items-center

                  gap-4
                "
              >
                <div
                  className="
                    h-px
                    flex-1

                    bg-slate-200
                  "
                />

                <span
                  className="
                    text-xs
                    font-medium

                    text-slate-400
                  "
                >
                  hoặc
                </span>

                <div
                  className="
                    h-px
                    flex-1

                    bg-slate-200
                  "
                />
              </div>

              {/* REGISTER */}

              <p
                className="
                  text-center

                  text-[14px]

                  !text-slate-500
                "
              >
                Chưa có tài khoản?{' '}

                <Link
                  to="/register"

                  className="
                    font-bold

                    text-blue-600

                    transition-colors

                    hover:text-blue-700
                  "
                >
                  Đăng ký ngay
                </Link>
              </p>

            </section>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   FEATURE CARD
========================================================== */

interface LoginFeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function LoginFeatureCard({
  icon,
  title,
  description,
}: LoginFeatureCardProps) {
  return (
    <article
      className="
        group

        min-h-[168px]

        rounded-[22px]

        border
        border-white/20

        bg-slate-950/55

        p-5

        shadow-[0_18px_45px_rgba(0,0,0,0.22)]

        backdrop-blur-md

        transition-all
        duration-300

        hover:-translate-y-1

        hover:border-cyan-300/35

        hover:bg-slate-900/70

        hover:shadow-[0_22px_55px_rgba(0,0,0,0.30)]
      "
    >

      {/* ICON */}

      <div
        className="
          mb-4

          flex

          h-12
          w-12

          items-center
          justify-center

          rounded-[14px]

          border
          border-cyan-200/20

          bg-gradient-to-br
          from-cyan-300/15
          to-blue-500/15

          text-cyan-300

          shadow-inner

          transition

          duration-300

          group-hover:scale-105

          group-hover:border-cyan-300/40
        "
      >
        <i
          className={`ph ${icon} text-[25px]`}
          aria-hidden="true"
        />
      </div>

      {/* TITLE */}

      <h3
        className="
          !text-[16px]

          !font-bold

          !leading-6

          !text-white
        "
        style={{
          textShadow:
            '0 2px 7px rgba(0,0,0,0.65)',
        }}
      >
        {title}
      </h3>

      {/* DESCRIPTION */}

      <p
        className="
          mt-1.5

          text-[13px]

          font-normal

          leading-5

          !text-slate-200
        "
      >
        {description}
      </p>

    </article>
  );
}