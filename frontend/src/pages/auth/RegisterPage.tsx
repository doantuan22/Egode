import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';

import { useRegister } from '../../features/auth/hooks';
import {
  registerSchema,
  RegisterFormValues,
} from '../../features/auth/schemas';

import { ApiError } from '../../services/apiClient';
import { applyServerFieldErrors } from '../../lib/apiErrors';
import { cn } from '../../lib/utils';
import { Button } from '../../components/common/Button';

type RegisterIntent = 'customer' | 'partner' | null;

const LOGO_SRC = '/egode_logo.png';

const REGISTER_FIELDS = ['TenDangNhap', 'Email', 'HoTen', 'SoDienThoai', 'NgaySinh', 'GioiTinh', 'MatKhau'] as const;

export default function RegisterPage() {
  const navigate = useNavigate();

  const [intent, setIntent] = useState<RegisterIntent>(null);

  const [selectedIntent, setSelectedIntent] = useState<
    Exclude<RegisterIntent, null> | null
  >(null);

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await registerMutation.mutateAsync({
        TenDangNhap: data.TenDangNhap,
        Email: data.Email,
        MatKhau: data.MatKhau,
        HoTen: data.HoTen,
        SoDienThoai: data.SoDienThoai,
        NgaySinh: data.NgaySinh || undefined,
        GioiTinh: data.GioiTinh || undefined,
      });

      navigate(intent === 'partner' ? '/partner/apply' : '/', {
        replace: true,
      });
    } catch (error) {
      // Field problems go onto their inputs; the banner (registerMutation.error) still says what happened.
      applyServerFieldErrors(error, setError, REGISTER_FIELDS);
    }
  };

  const inputClass = (hasError?: boolean) =>
    cn(
      `
        w-full
        rounded-xl
        border
        bg-white
        px-3.5
        py-2.5
        text-sm
        font-medium
        text-slate-900
        outline-none
        transition-all
        duration-200
        placeholder:text-slate-400
        focus:border-primary
        focus:ring-4
        focus:ring-primary/10
      `,
      hasError
        ? 'border-danger bg-danger-light/20'
        : 'border-slate-200 hover:border-slate-300'
    );

  return (
    <div
      className="
        relative
        overflow-hidden
        bg-cover
        bg-center
        bg-no-repeat
      "
      style={{
        minHeight: 'calc(100vh - var(--header-height))',
        backgroundImage: "url('/register_bg.jpg')",
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <div
        className="
          absolute
          inset-0
          bg-gradient-to-r
          from-slate-950/60
          via-slate-900/20
          to-transparent
        "
      />

      <div
        className="
          absolute
          inset-x-0
          bottom-0
          h-[28%]
          bg-gradient-to-t
          from-slate-950/25
          to-transparent
        "
      />

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div
        className="
          relative
          z-10
          mx-auto
          flex
          w-full
          max-w-[1500px]
          items-center
          px-7
          py-6
          lg:px-12
          xl:px-14
        "
        style={{
          minHeight: 'calc(100vh - var(--header-height))',
        }}
      >
        <div
          className="
            grid
            w-full
            items-center
            gap-10
            lg:grid-cols-[1.05fr_0.95fr]
            xl:gap-14
          "
        >
          {/* =================================================
              LEFT HERO
          ================================================= */}

          <section className="hidden lg:block">
            <div className="max-w-[760px]">
              <div className="relative inline-block">
                {/* DÒNG 1 */}

                <h1
                  className="
                    whitespace-nowrap
                    text-[clamp(3rem,4vw,4.35rem)]
                    font-bold
                    italic
                    leading-[1]
                    tracking-[-0.035em]
                  "
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    color: '#FFFFFF',
                    textShadow:
                      '0 3px 6px rgba(0,0,0,0.85), 0 10px 26px rgba(0,0,0,0.55)',
                  }}
                >
                  Khám phá kỳ nghỉ
                </h1>

                {/* DÒNG 2 */}

                <div
                  className="
                    mt-1
                    whitespace-nowrap
                    text-[clamp(3.05rem,4.15vw,4.5rem)]
                    font-extrabold
                    italic
                    leading-[1]
                    tracking-[-0.045em]
                  "
                  style={{
                    fontFamily:
                      '"Segoe UI", Arial, Helvetica, sans-serif',
                  }}
                >
                  <span
                    style={{
                      color: '#FFFFFF',
                      textShadow:
                        '0 3px 6px rgba(0,0,0,0.85), 0 8px 22px rgba(0,0,0,0.50)',
                    }}
                  >
                    theo{' '}
                  </span>

                  <span
                    style={{
                      color: '#66D9FF',
                      textShadow:
                        '0 3px 6px rgba(0,0,0,0.75), 0 8px 20px rgba(0,0,0,0.45)',
                    }}
                  >
                    cách của bạn.
                  </span>
                </div>

                {/* SUN DOODLE */}

                <svg
                  viewBox="0 0 80 80"
                  className="
                    absolute
                    right-[-58px]
                    top-[16px]
                    h-[48px]
                    w-[48px]
                  "
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M40 11V2"
                    stroke="#FFD447"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M59 19L65 12"
                    stroke="#FFD447"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M66 38H76"
                    stroke="#FFD447"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M21 19L15 12"
                    stroke="#FFD447"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M14 38H4"
                    stroke="#FFD447"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M28 46C28 38 33 32 40 32C47 32 52 38 52 46"
                    stroke="#FFD447"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>

                {/* =================================================
                    BRUSH WAVE
                ================================================= */}

                <div className="mt-[3px] ml-[78px]">
                  <svg
                    viewBox="0 0 560 48"
                    fill="none"
                    className="
                      h-[32px]
                      w-[470px]
                      overflow-visible
                    "
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="brushWaveGradient"
                        x1="0"
                        y1="0"
                        x2="560"
                        y2="0"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop
                          offset="0%"
                          stopColor="#8BE8FF"
                          stopOpacity="0.15"
                        />

                        <stop
                          offset="12%"
                          stopColor="#75E2FF"
                          stopOpacity="0.95"
                        />

                        <stop
                          offset="48%"
                          stopColor="#55CEF5"
                        />

                        <stop
                          offset="84%"
                          stopColor="#72DFFF"
                          stopOpacity="0.96"
                        />

                        <stop
                          offset="100%"
                          stopColor="#A2EEFF"
                          stopOpacity="0.12"
                        />
                      </linearGradient>

                      <filter
                        id="brushSoftGlow"
                        x="-20%"
                        y="-100%"
                        width="140%"
                        height="300%"
                      >
                        <feGaussianBlur
                          stdDeviation="1.4"
                          result="blur"
                        />

                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* NÉT CỌ CHÍNH */}

                    <path
                      d="
                        M8 26
                        C86 12 167 8 252 10
                        C335 12 416 21 548 24

                        C431 27 343 24 255 21
                        C169 18 90 20 8 31
                        Z
                      "
                      fill="url(#brushWaveGradient)"
                      opacity="0.98"
                      filter="url(#brushSoftGlow)"
                    />

                    {/* NÉT CỌ NHỎ */}

                    <path
                      d="
                        M118 36
                        C184 31 257 30 325 32
                        C383 34 430 37 477 41

                        C421 39 373 38 319 37
                        C252 35 186 35 118 39
                        Z
                      "
                      fill="#82E5FF"
                      opacity="0.38"
                    />
                  </svg>
                </div>
              </div>

              {/* DESCRIPTION */}

              <p
                className="
                  mt-2
                  max-w-[650px]
                  text-[16px]
                  font-semibold
                  leading-7
                "
                style={{
                  color: '#FFFFFF',
                  textShadow:
                    '0 2px 5px rgba(0,0,0,0.95), 0 5px 14px rgba(0,0,0,0.55)',
                }}
              >
                Tạo tài khoản Egode để tìm kiếm khách sạn,
                đặt phòng nhanh chóng và quản lý toàn bộ chuyến đi
                của bạn trên một nền tảng duy nhất.
              </p>
            </div>

            {/* =================================================
                FEATURE CARDS
            ================================================= */}

            <div
              className="
                mt-8
                grid
                max-w-[680px]
                grid-cols-3
                gap-4
              "
            >
              <FeatureCard
                icon="ph-magnifying-glass"
                title="Dễ tìm kiếm"
                description="Tìm nơi lưu trú phù hợp nhanh chóng."
              />

              <FeatureCard
                icon="ph-shield-check"
                title="An toàn"
                description="Quản lý tài khoản và đơn đặt phòng."
              />

              <FeatureCard
                icon="ph-cursor-click"
                title="Tiện lợi"
                description="Trải nghiệm đặt phòng đơn giản."
              />
            </div>
          </section>

          {/* =================================================
              RIGHT SIDE
          ================================================= */}

          <div className="flex justify-center lg:justify-end">
            {intent === null ? (
              /* =============================================
                  STEP 1
              ============================================= */

              <section
                className="
                  w-full
                  max-w-[540px]
                  rounded-[30px]
                  border
                  border-white/80
                  bg-white/95
                  px-7
                  py-7
                  shadow-[0_25px_80px_rgba(15,23,42,0.25)]
                  backdrop-blur-xl
                "
                style={{
                  maxHeight:
                    'calc(100vh - var(--header-height) - 28px)',
                  overflowY: 'auto',
                }}
              >
                {/* LOGO */}

                <div className="mb-4 flex justify-center">
                  <img
                    src={LOGO_SRC}
                    alt="Egode"
                    className="
                      h-[62px]
                      w-auto
                      max-w-[210px]
                      object-contain
                    "
                  />
                </div>

                <div className="mb-6 text-center">
                  <h1
                    className="
                      text-[29px]
                      font-extrabold
                      tracking-[-0.025em]
                      text-slate-900
                    "
                  >
                    Tạo tài khoản
                  </h1>

                  <p className="mt-1.5 text-sm font-medium text-slate-500">
                    Chọn cách bạn muốn sử dụng Egode
                  </p>
                </div>

                <fieldset className="space-y-4">
                  <legend className="sr-only">
                    Chọn mục đích đăng ký
                  </legend>

                  <IntentOption
                    value="customer"
                    selected={selectedIntent === 'customer'}
                    onSelect={() =>
                      setSelectedIntent('customer')
                    }
                    icon="ph-suitcase-rolling"
                    title="Khách hàng"
                    description="Đặt phòng, quản lý chuyến đi, đánh giá khách sạn và nhận ưu đãi."
                    tone="blue"
                  />

                  <IntentOption
                    value="partner"
                    selected={selectedIntent === 'partner'}
                    onSelect={() =>
                      setSelectedIntent('partner')
                    }
                    icon="ph-buildings"
                    title="Đối tác khách sạn"
                    description="Đăng khách sạn, quản lý phòng, giá bán và hoạt động kinh doanh."
                    tone="green"
                  />
                </fieldset>

                <Button
                  type="button"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={!selectedIntent}
                  onClick={() =>
                    selectedIntent &&
                    setIntent(selectedIntent)
                  }
                >
                  Tiếp tục
                  <i className="ph ph-arrow-right ml-1 text-lg" />
                </Button>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />

                  <span className="text-xs font-medium text-slate-400">
                    hoặc
                  </span>

                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <p className="text-center text-sm font-medium text-slate-500">
                  Đã có tài khoản?{' '}

                  <Link
                    to="/login"
                    className="font-bold text-primary hover:underline"
                  >
                    Đăng nhập
                  </Link>
                </p>
              </section>
            ) : (
              /* =============================================
                  STEP 2
              ============================================= */

              <section
                className="
                  w-full
                  max-w-[700px]
                  overflow-hidden
                  rounded-[28px]
                  border
                  border-white/75
                  bg-white/96
                  shadow-[0_24px_80px_rgba(15,23,42,0.25)]
                  backdrop-blur-xl
                "
                style={{
                  maxHeight:
                    'calc(100vh - var(--header-height) - 28px)',
                  overflowY: 'auto',
                }}
              >
                {/* FORM HEADER */}

                <div
                  className="
                    border-b
                    border-slate-100
                    px-6
                    pb-4
                    pt-5
                    sm:px-7
                  "
                >
                  <button
                    type="button"
                    onClick={() => setIntent(null)}
                    className="
                      mb-3
                      flex
                      items-center
                      gap-1.5
                      rounded-lg
                      px-2
                      py-1
                      text-sm
                      font-semibold
                      text-slate-500
                      transition
                      hover:bg-slate-100
                      hover:text-slate-900
                    "
                  >
                    <i className="ph ph-arrow-left" />
                    Quay lại
                  </button>

                  <div className="flex items-center gap-4">
                    <img
                      src={LOGO_SRC}
                      alt="Egode"
                      className="
                        h-12
                        w-auto
                        max-w-[155px]
                        object-contain
                      "
                    />

                    <div>
                      <h1
                        className="
                          text-[23px]
                          font-extrabold
                          tracking-[-0.02em]
                          text-slate-900
                        "
                      >
                        Tạo tài khoản{' '}
                        {intent === 'customer'
                          ? 'khách hàng'
                          : 'đối tác'}
                      </h1>

                      <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                        {intent === 'customer'
                          ? 'Điền thông tin để bắt đầu đặt phòng trên Egode.'
                          : 'Tạo tài khoản trước khi đăng ký khách sạn của bạn.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* FORM */}

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-4 p-6 sm:p-7"
                  noValidate
                >
                  {registerMutation.isError && (
                    <div
                      role="alert"
                      className="
                        flex
                        items-start
                        gap-3
                        rounded-xl
                        border
                        border-danger/25
                        bg-danger-light
                        px-4
                        py-3
                        text-sm
                        text-danger-ink
                      "
                    >
                      <i className="ph-fill ph-warning-circle mt-0.5 text-lg" />

                      <span>
                        {registerMutation.error instanceof ApiError
                          ? registerMutation.error.message
                          : 'Đăng ký thất bại, vui lòng thử lại'}
                      </span>
                    </div>
                  )}

                  <div
                    className="
                      grid
                      grid-cols-1
                      gap-x-4
                      gap-y-4
                      sm:grid-cols-2
                    "
                  >
                    <FormField
                      label="Họ tên"
                      required
                      error={errors.HoTen?.message}
                    >
                      <div className="relative">
                        <i className="ph ph-user absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input
                          id="register-HoTen"
                          type="text"
                          placeholder="Nguyễn Văn A"
                          className={cn(
                            inputClass(!!errors.HoTen),
                            'pl-10'
                          )}
                          {...register('HoTen')}
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Ngày sinh"
                      error={errors.NgaySinh?.message}
                    >
                      <input
                        id="register-NgaySinh"
                        type="date"
                        className={inputClass(
                          !!errors.NgaySinh
                        )}
                        {...register('NgaySinh')}
                      />
                    </FormField>

                    <FormField
                      label="Tên đăng nhập"
                      required
                      error={errors.TenDangNhap?.message}
                    >
                      <div className="relative">
                        <i className="ph ph-identification-card absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input
                          id="register-TenDangNhap"
                          type="text"
                          placeholder="nguyenvana123"
                          className={cn(
                            inputClass(
                              !!errors.TenDangNhap
                            ),
                            'pl-10'
                          )}
                          {...register('TenDangNhap')}
                        />
                      </div>
                    </FormField>

                    <div className="space-y-1.5">
                      <p className="block text-xs font-bold uppercase tracking-wide text-slate-700">
                        Giới tính
                      </p>

                      <div className="flex min-h-[42px] items-center gap-2">
                        {['Nam', 'Nữ', 'Khác'].map(
                          (gender) => (
                            <label
                              key={gender}
                              className="cursor-pointer"
                            >
                              <input
                                type="radio"
                                value={gender}
                                {...register('GioiTinh')}
                                className="peer sr-only"
                              />

                              <span
                                className="
                                  inline-flex
                                  rounded-xl
                                  border
                                  border-slate-200
                                  bg-white
                                  px-3.5
                                  py-2
                                  text-sm
                                  font-semibold
                                  text-slate-500
                                  transition
                                  peer-checked:border-primary
                                  peer-checked:bg-primary/10
                                  peer-checked:text-primary
                                "
                              >
                                {gender}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>

                    <FormField
                      label="Email"
                      required
                      error={errors.Email?.message}
                    >
                      <div className="relative">
                        <i className="ph ph-envelope-simple absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input
                          id="register-Email"
                          type="email"
                          placeholder="example@gmail.com"
                          className={cn(
                            inputClass(!!errors.Email),
                            'pl-10'
                          )}
                          {...register('Email')}
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Số điện thoại"
                      required
                      error={errors.SoDienThoai?.message}
                    >
                      <div className="relative">
                        <i className="ph ph-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input
                          id="register-SoDienThoai"
                          type="tel"
                          placeholder="0901234567"
                          className={cn(
                            inputClass(
                              !!errors.SoDienThoai
                            ),
                            'pl-10'
                          )}
                          {...register('SoDienThoai')}
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Mật khẩu"
                      required
                      error={errors.MatKhau?.message}
                    >
                      <div className="relative">
                        <i className="ph ph-lock-simple absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input
                          id="register-MatKhau"
                          type={
                            showPwd
                              ? 'text'
                              : 'password'
                          }
                          placeholder="Tối thiểu 8 ký tự"
                          className={cn(
                            inputClass(
                              !!errors.MatKhau
                            ),
                            'pl-10 pr-11'
                          )}
                          {...register('MatKhau')}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPwd(!showPwd)
                          }
                          className="
                            absolute
                            right-3.5
                            top-1/2
                            -translate-y-1/2
                            text-slate-400
                            hover:text-slate-800
                          "
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
                    </FormField>

                    <FormField
                      label="Xác nhận mật khẩu"
                      required
                      error={
                        errors.confirmMatKhau?.message
                      }
                    >
                      <div className="relative">
                        <i className="ph ph-lock-key absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input
                          id="register-confirmMatKhau"
                          type={
                            showConfirmPwd
                              ? 'text'
                              : 'password'
                          }
                          placeholder="Nhập lại mật khẩu"
                          className={cn(
                            inputClass(
                              !!errors.confirmMatKhau
                            ),
                            'pl-10 pr-11'
                          )}
                          {...register(
                            'confirmMatKhau'
                          )}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPwd(
                              !showConfirmPwd
                            )
                          }
                          className="
                            absolute
                            right-3.5
                            top-1/2
                            -translate-y-1/2
                            text-slate-400
                            hover:text-slate-800
                          "
                        >
                          <i
                            className={cn(
                              'ph text-lg',
                              showConfirmPwd
                                ? 'ph-eye'
                                : 'ph-eye-slash'
                            )}
                          />
                        </button>
                      </div>
                    </FormField>
                  </div>

                  {/* TERMS */}

                  <label
                    className="
                      flex
                      cursor-pointer
                      items-start
                      gap-3
                      rounded-xl
                      border
                      border-slate-100
                      bg-slate-50
                      px-4
                      py-3
                    "
                  >
                    <input
                      type="checkbox"
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />

                    <span className="text-sm font-medium leading-5 text-slate-500">
                      Tôi đồng ý với{' '}

                      <span className="font-bold text-primary">
                        Điều khoản sử dụng
                      </span>{' '}

                      và{' '}

                      <span className="font-bold text-primary">
                        Chính sách bảo mật
                      </span>{' '}

                      của Egode.
                    </span>
                  </label>

                  {/* SUBMIT */}

                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      registerMutation.isPending
                    }
                    size="lg"
                    className="w-full"
                  >
                    {isSubmitting ||
                    registerMutation.isPending ? (
                      <>
                        Đang xử lý...

                        <div
                          className="
                            spinner
                            h-4
                            w-4
                            border-2
                            border-white/20
                            border-t-white
                          "
                          aria-hidden="true"
                        />
                      </>
                    ) : (
                      <>
                        Đăng ký tài khoản
                        <i className="ph ph-arrow-right ml-1 text-lg" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm font-medium text-slate-500">
                    Đã có tài khoản?{' '}

                    <Link
                      to="/login"
                      className="font-bold text-primary hover:underline"
                    >
                      Đăng nhập
                    </Link>
                  </p>
                </form>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FEATURE CARD
========================================================= */

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({
  icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div
      className="
        rounded-[22px]
        border
        border-white/25
        bg-[#102033]/84
        p-5
        shadow-lg
        backdrop-blur-xl
        transition
        duration-300
        hover:-translate-y-1
        hover:bg-[#152A42]/94
      "
    >
      <div
        className="
          mb-4
          flex
          h-12
          w-12
          items-center
          justify-center
          rounded-2xl
          border
          border-white/20
          bg-white/10
          text-sky-300
        "
      >
        <i className={`ph ${icon} text-[26px]`} />
      </div>

      <p className="text-[17px] font-extrabold text-white">
        {title}
      </p>

      <p className="mt-2 text-[13px] font-medium leading-6 text-slate-200">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   INTENT OPTION
========================================================= */

interface IntentOptionProps {
  value: 'customer' | 'partner';
  selected: boolean;
  onSelect: () => void;
  icon: string;
  title: string;
  description: string;
  tone: 'blue' | 'green';
}

function IntentOption({
  value,
  selected,
  onSelect,
  icon,
  title,
  description,
  tone,
}: IntentOptionProps) {
  const selectedClasses =
    tone === 'blue'
      ? 'border-primary bg-primary/5 shadow-sm'
      : 'border-emerald-500 bg-emerald-50 shadow-sm';

  const iconClasses =
    tone === 'blue'
      ? selected
        ? 'bg-primary text-white'
        : 'bg-sky-50 text-primary'
      : selected
        ? 'bg-emerald-500 text-white'
        : 'bg-emerald-50 text-emerald-600';

  return (
    <label
      className={cn(
        `
          flex
          cursor-pointer
          items-center
          gap-4
          rounded-2xl
          border-2
          p-4
          transition-all
          duration-200
          hover:-translate-y-0.5
          hover:shadow-md
        `,
        selected
          ? selectedClasses
          : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      <input
        type="radio"
        name="register-intent"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />

      <div
        className={cn(
          `
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center
            rounded-2xl
            text-[22px]
            transition-all
          `,
          iconClasses
        )}
      >
        <i className={`ph ${icon}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-[17px] font-extrabold text-slate-900">
            {title}
          </strong>

          {selected && (
            <i
              className={cn(
                'ph-fill ph-check-circle text-xl',
                tone === 'blue'
                  ? 'text-primary'
                  : 'text-emerald-600'
              )}
            />
          )}
        </div>

        <p className="mt-1 text-[13px] font-medium leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </label>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

function FormField({
  label,
  required,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        className="
          block
          text-xs
          font-bold
          uppercase
          tracking-wide
          text-slate-700
        "
      >
        {label}

        {required && (
          <span className="text-danger">*</span>
        )}
      </label>

      {children}

      {error && (
        <p className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}