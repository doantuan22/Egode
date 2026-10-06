import { useState } from 'react';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { Link, useNavigate } from 'react-router-dom';



import { useRegister } from '../../features/auth/hooks';

import {

  registerSchema,

  RegisterFormValues,

} from '../../features/auth/schemas';



import { ApiError } from '../../services/apiClient';

import { cn } from '../../lib/utils';

import { Button } from '../../components/common/Button';



type RegisterIntent = 'customer' | 'partner' | null;



export default function RegisterPage() {

  const navigate = useNavigate();



  const [intent, setIntent] =

    useState<RegisterIntent>(null);



  const [selectedIntent, setSelectedIntent] =

    useState<Exclude<RegisterIntent, null> | null>(

      null

    );



  const [showPwd, setShowPwd] = useState(false);

  const [showConfirmPwd, setShowConfirmPwd] =

    useState(false);



  const registerMutation = useRegister();



  const {

    register,

    handleSubmit,

    formState: { errors, isSubmitting },

  } = useForm<RegisterFormValues>({

    resolver: zodResolver(registerSchema),

  });



  const onSubmit = async (

    data: RegisterFormValues

  ) => {

    try {

      await registerMutation.mutateAsync({

        TenDangNhap: data.TenDangNhap,

        Email: data.Email,

        MatKhau: data.MatKhau,

        HoTen: data.HoTen,

        SoDienThoai: data.SoDienThoai,

        NgaySinh:

          data.NgaySinh || undefined,

        GioiTinh:

          data.GioiTinh || undefined,

      });



      navigate(

        intent === 'partner'

          ? '/partner/apply'

          : '/',

        { replace: true }

      );

    } catch {

      // lỗi hiển thị qua registerMutation

    }

  };



  const inputClass = (hasError?: boolean) =>

    cn(

      `

        w-full

        rounded-xl

        border

        bg-white/95

        py-3

        text-sm

        text-slate-900

        outline-none

        transition-all

        duration-200

        placeholder:text-slate-400

        focus:border-blue-500

        focus:ring-4

        focus:ring-blue-500/10

      `,

      hasError

        ? 'border-danger bg-danger-light/30'

        : 'border-slate-200 hover:border-slate-300'

    );



  return (

    <div

      className="

        relative

        min-h-[calc(100vh-64px)]

        overflow-hidden

        bg-cover

        bg-center

        bg-no-repeat

      "

      style={{

        backgroundImage:

          "url('/register_bg.jpg')",

      }}

    >

      {/* BACKGROUND */}

      <div

        className="

          absolute

          inset-0

          bg-gradient-to-r

          from-slate-950/86

          via-slate-950/62

          to-sky-950/28

        "

      />



      <div

        className="

          absolute

          inset-0

          bg-[radial-gradient(circle_at_78%_18%,rgba(56,189,248,0.14),transparent_28%)]

        "

      />



      <div

        className="

          absolute

          inset-x-0

          bottom-0

          h-[42%]

          bg-gradient-to-t

          from-slate-950/38

          to-transparent

        "

      />



      {/* CONTENT */}

      <div

        className="

          relative

          z-10

          mx-auto

          flex

          min-h-[calc(100vh-64px)]

          max-w-[1500px]

          items-center

          px-5

          py-10

          sm:px-8

          lg:px-12

          xl:px-16

        "

      >

        <div

          className="

            grid

            w-full

            items-center

            gap-12

            lg:grid-cols-[0.95fr_1.05fr]

            xl:gap-20

          "

        >

          {/* ============================

              LEFT HERO

          ============================ */}

          <div className="hidden lg:block">

            {/* BADGE */}

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

                text-sm

                font-bold

                tracking-wide

                text-slate-100

                shadow-lg

                backdrop-blur-xl

              "

            >

              <i className="ph ph-buildings text-lg text-sky-300" />

              <span>EGODE</span>

            </div>



            {/* TITLE */}

            <h1

              className="

                max-w-[680px]

                text-[48px]

                font-bold

                leading-[1.08]

                tracking-[-0.03em]

                !text-white

                xl:text-[62px]

              "

              style={{

                fontFamily:

                  '"Georgia", "Times New Roman", serif',

                color: '#FFFFFF',

                textShadow:

                  '0 3px 8px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.30)',

              }}

            >

              Khám phá kỳ nghỉ



              <span

                className="

                  mt-1

                  block

                  bg-gradient-to-r

                  from-cyan-200

                  via-sky-300

                  to-blue-400

                  bg-clip-text

                  !text-transparent

                "

                style={{

                  textShadow: 'none',

                }}

              >

                theo cách của bạn.

              </span>

            </h1>



            {/* DESCRIPTION */}

            <p

              className="

                mt-6

                max-w-[600px]

                text-[17px]

                font-medium

                leading-8

                !text-white

              "

              style={{

                color: '#FFFFFF',

                textShadow:

                  '0 2px 6px rgba(0,0,0,0.78)',

              }}

            >

              Tạo tài khoản Egode để tìm kiếm khách

              sạn, đặt phòng nhanh chóng và quản lý

              toàn bộ chuyến đi của bạn trên một nền

              tảng duy nhất.

            </p>



            {/* FEATURE CARDS */}

            <div

              className="

                mt-9

                grid

                max-w-[680px]

                grid-cols-3

                gap-4

              "

            >

              <RegisterFeatureCard

                icon="ph-magnifying-glass"

                title="Dễ tìm kiếm"

                description="Tìm nơi lưu trú phù hợp nhanh chóng."

              />



              <RegisterFeatureCard

                icon="ph-shield-check"

                title="An toàn"

                description="Quản lý tài khoản và đơn đặt phòng."

              />



              <RegisterFeatureCard

                icon="ph-lightning"

                title="Tiện lợi"

                description="Trải nghiệm đặt phòng đơn giản."

              />

            </div>

          </div>



          {/* ============================

              RIGHT

          ============================ */}

          <div className="flex justify-center lg:justify-end">

            {intent === null ? (

              <div

                className="

                  w-full

                  max-w-[570px]

                  rounded-[32px]

                  border

                  border-white/70

                  bg-white/95

                  p-7

                  shadow-[0_30px_100px_rgba(15,23,42,0.32)]

                  backdrop-blur-2xl

                  sm:p-10

                "

              >

                <div

                  className="

                    mx-auto

                    mb-5

                    flex

                    h-16

                    w-16

                    items-center

                    justify-center

                    rounded-[20px]

                    bg-gradient-to-br

                    from-blue-50

                    to-blue-100

                    text-blue-600

                    shadow-sm

                  "

                >

                  <i className="ph ph-user-plus text-[28px]" />

                </div>



                <div className="mb-8 text-center">

                  <h1

                    className="

                      text-[30px]

                      font-extrabold

                      tracking-[-0.025em]

                      text-slate-900

                    "

                  >

                    Tạo tài khoản

                  </h1>



                  <p className="mt-2 text-[15px] text-slate-500">

                    Chọn cách bạn muốn sử dụng

                    Egode

                  </p>

                </div>



                <fieldset className="space-y-4">

                  <legend className="sr-only">

                    Chọn mục đích đăng ký

                  </legend>



                  {/* CUSTOMER */}

                  <label

                    className={cn(

                      `

                        group

                        flex

                        cursor-pointer

                        items-center

                        gap-4

                        rounded-2xl

                        border-2

                        p-5

                        transition-all

                        duration-200

                      `,

                      selectedIntent === 'customer'

                        ? `

                            border-blue-500

                            bg-blue-50/70

                            shadow-[0_8px_25px_rgba(37,99,235,0.10)]

                          `

                        : `

                            border-slate-200

                            bg-white

                            hover:-translate-y-0.5

                            hover:border-blue-300

                            hover:shadow-lg

                          `

                    )}

                  >

                    <input

                      type="radio"

                      name="register-intent"

                      value="customer"

                      checked={

                        selectedIntent ===

                        'customer'

                      }

                      onChange={() =>

                        setSelectedIntent(

                          'customer'

                        )

                      }

                      className="sr-only"

                    />



                    <div

                      className={cn(

                        `

                          flex

                          h-14

                          w-14

                          shrink-0

                          items-center

                          justify-center

                          rounded-2xl

                          text-[24px]

                          transition-all

                        `,

                        selectedIntent === 'customer'

                          ? 'bg-blue-600 text-white shadow-md'

                          : 'bg-sky-50 text-sky-600'

                      )}

                    >

                      <i className="ph ph-suitcase-rolling" />

                    </div>



                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-3">

                        <strong className="text-[17px] font-bold text-slate-900">

                          Khách hàng

                        </strong>



                        {selectedIntent ===

                          'customer' && (

                          <i className="ph-fill ph-check-circle text-[22px] text-blue-600" />

                        )}

                      </div>



                      <p className="mt-1.5 text-sm leading-6 text-slate-500">

                        Đặt phòng, quản lý chuyến đi,

                        đánh giá khách sạn và nhận ưu

                        đãi.

                      </p>

                    </div>

                  </label>



                  {/* PARTNER */}

                  <label

                    className={cn(

                      `

                        group

                        flex

                        cursor-pointer

                        items-center

                        gap-4

                        rounded-2xl

                        border-2

                        p-5

                        transition-all

                        duration-200

                      `,

                      selectedIntent === 'partner'

                        ? `

                            border-emerald-500

                            bg-emerald-50/70

                            shadow-[0_8px_25px_rgba(16,185,129,0.10)]

                          `

                        : `

                            border-slate-200

                            bg-white

                            hover:-translate-y-0.5

                            hover:border-emerald-300

                            hover:shadow-lg

                          `

                    )}

                  >

                    <input

                      type="radio"

                      name="register-intent"

                      value="partner"

                      checked={

                        selectedIntent ===

                        'partner'

                      }

                      onChange={() =>

                        setSelectedIntent(

                          'partner'

                        )

                      }

                      className="sr-only"

                    />



                    <div

                      className={cn(

                        `

                          flex

                          h-14

                          w-14

                          shrink-0

                          items-center

                          justify-center

                          rounded-2xl

                          text-[24px]

                          transition-all

                        `,

                        selectedIntent === 'partner'

                          ? 'bg-emerald-600 text-white shadow-md'

                          : 'bg-emerald-50 text-emerald-600'

                      )}

                    >

                      <i className="ph ph-buildings" />

                    </div>



                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-3">

                        <strong className="text-[17px] font-bold text-slate-900">

                          Đối tác khách sạn

                        </strong>



                        {selectedIntent ===

                          'partner' && (

                          <i className="ph-fill ph-check-circle text-[22px] text-emerald-600" />

                        )}

                      </div>



                      <p className="mt-1.5 text-sm leading-6 text-slate-500">

                        Đăng khách sạn, quản lý

                        phòng, giá bán và hoạt động

                        kinh doanh.

                      </p>

                    </div>

                  </label>

                </fieldset>



                <Button

                  type="button"

                  size="lg"

                  className="mt-7 w-full"

                  disabled={!selectedIntent}

                  onClick={() =>

                    selectedIntent &&

                    setIntent(selectedIntent)

                  }

                >

                  Tiếp tục

                  <i className="ph ph-arrow-right ml-1 text-lg" />

                </Button>



                <div className="my-7 flex items-center gap-4">

                  <div className="h-px flex-1 bg-slate-200" />

                  <span className="text-xs font-medium text-slate-400">

                    hoặc

                  </span>

                  <div className="h-px flex-1 bg-slate-200" />

                </div>



                <p className="text-center text-sm text-slate-500">

                  Đã có tài khoản?{' '}

                  <Link

                    to="/login"

                    className="

                      font-bold

                      text-blue-600

                      transition

                      hover:text-blue-700

                      hover:underline

                    "

                  >

                    Đăng nhập

                  </Link>

                </p>

              </div>

            ) : (

              <div

                className="

                  w-full

                  max-w-[730px]

                  overflow-hidden

                  rounded-[30px]

                  border

                  border-white/70

                  bg-white/95

                  shadow-[0_30px_100px_rgba(15,23,42,0.32)]

                  backdrop-blur-2xl

                "

              >

                {/* FORM HEADER */}

                <div className="border-b border-slate-100 px-7 pb-6 pt-7 sm:px-9">

                  <button

                    type="button"

                    onClick={() =>

                      setIntent(null)

                    }

                    className="

                      mb-5

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



                  <div className="flex items-start gap-4">

                    <div

                      className="

                        flex

                        h-[52px]

                        w-[52px]

                        shrink-0

                        items-center

                        justify-center

                        rounded-2xl

                        bg-blue-50

                        text-[22px]

                        text-blue-600

                      "

                    >

                      <i

                        className={

                          intent === 'customer'

                            ? 'ph ph-user'

                            : 'ph ph-buildings'

                        }

                      />

                    </div>



                    <div>

                      <h1 className="text-[25px] font-extrabold tracking-[-0.02em] text-slate-900">

                        Tạo tài khoản{' '}

                        {intent === 'customer'

                          ? 'khách hàng'

                          : 'đối tác'}

                      </h1>



                      <p className="mt-1.5 text-sm leading-6 text-slate-500">

                        {intent === 'customer'

                          ? 'Điền thông tin để bắt đầu đặt phòng trên Egode.'

                          : 'Tạo tài khoản trước khi đăng ký khách sạn của bạn.'}

                      </p>

                    </div>

                  </div>

                </div>



                {/* FORM */}

                <form

                  onSubmit={handleSubmit(

                    onSubmit

                  )}

                  className="space-y-5 p-7 sm:p-9"

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

                        {registerMutation.error instanceof

                        ApiError

                          ? registerMutation.error

                              .message

                          : 'Đăng ký thất bại, vui lòng thử lại'}

                      </span>

                    </div>

                  )}



                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">

                    {/* HỌ TÊN */}

                    <div className="space-y-1.5">

                      <label

                        htmlFor="register-HoTen"

                        className="block text-xs font-bold uppercase tracking-wide text-slate-700"

                      >

                        Họ tên

                        <span className="text-danger">

                          *

                        </span>

                      </label>



                      <div className="relative">

                        <i className="ph ph-user absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input

                          id="register-HoTen"

                          type="text"

                          placeholder="Nguyễn Văn A"

                          className={cn(

                            inputClass(

                              !!errors.HoTen

                            ),

                            'pl-10 pr-3.5'

                          )}

                          {...register('HoTen')}

                        />

                      </div>



                      {errors.HoTen && (

                        <p className="flex items-center gap-1 text-xs font-medium text-danger">

                          <i className="ph-fill ph-warning-circle" />

                          {errors.HoTen.message}

                        </p>

                      )}

                    </div>



                    {/* NGÀY SINH */}

                    <div className="space-y-1.5">

                      <label

                        htmlFor="register-NgaySinh"

                        className="block text-xs font-bold uppercase tracking-wide text-slate-700"

                      >

                        Ngày sinh

                      </label>



                      <input

                        id="register-NgaySinh"

                        type="date"

                        className={cn(

                          inputClass(

                            !!errors.NgaySinh

                          ),

                          'px-3.5'

                        )}

                        {...register('NgaySinh')}

                      />

                    </div>



                    {/* USERNAME */}

                    <div className="space-y-1.5">

                      <label

                        htmlFor="register-TenDangNhap"

                        className="block text-xs font-bold uppercase tracking-wide text-slate-700"

                      >

                        Tên đăng nhập

                        <span className="text-danger">

                          *

                        </span>

                      </label>



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

                            'pl-10 pr-3.5'

                          )}

                          {...register(

                            'TenDangNhap'

                          )}

                        />

                      </div>



                      {errors.TenDangNhap && (

                        <p className="flex items-center gap-1 text-xs font-medium text-danger">

                          <i className="ph-fill ph-warning-circle" />

                          {

                            errors

                              .TenDangNhap

                              .message

                          }

                        </p>

                      )}

                    </div>



                    {/* GENDER */}

                    <div className="space-y-1.5">

                      <p className="block text-xs font-bold uppercase tracking-wide text-slate-700">

                        Giới tính

                      </p>



                      <div className="flex min-h-[46px] items-center gap-2">

                        {[

                          'Nam',

                          'Nữ',

                          'Khác',

                        ].map(

                          (gender) => (

                            <label

                              key={gender}

                              className="cursor-pointer"

                            >

                              <input

                                type="radio"

                                value={gender}

                                {...register(

                                  'GioiTinh'

                                )}

                                className="peer sr-only"

                              />



                              <span

                                className="

                                  inline-flex

                                  rounded-xl

                                  border

                                  border-slate-200

                                  bg-white

                                  px-4

                                  py-2.5

                                  text-sm

                                  font-semibold

                                  text-slate-500

                                  transition

                                  hover:border-blue-300

                                  peer-checked:border-blue-500

                                  peer-checked:bg-blue-50

                                  peer-checked:text-blue-600

                                "

                              >

                                {gender}

                              </span>

                            </label>

                          )

                        )}

                      </div>

                    </div>



                    {/* EMAIL */}

                    <div className="space-y-1.5">

                      <label

                        htmlFor="register-Email"

                        className="block text-xs font-bold uppercase tracking-wide text-slate-700"

                      >

                        Email

                        <span className="text-danger">

                          *

                        </span>

                      </label>



                      <div className="relative">

                        <i className="ph ph-envelope-simple absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />

                        <input

                          id="register-Email"

                          type="email"

                          placeholder="example@gmail.com"

                          className={cn(

                            inputClass(

                              !!errors.Email

                            ),

                            'pl-10 pr-3.5'

                          )}

                          {...register('Email')}

                        />

                      </div>



                      {errors.Email && (

                        <p className="flex items-center gap-1 text-xs font-medium text-danger">

                          <i className="ph-fill ph-warning-circle" />

                          {errors.Email.message}

                        </p>

                      )}

                    </div>



                    {/* PHONE */}

                    <div className="space-y-1.5">

                      <label

                        htmlFor="register-SoDienThoai"

                        className="block text-xs font-bold uppercase tracking-wide text-slate-700"

                      >

                        Số điện thoại

                        <span className="text-danger">

                          *

                        </span>

                      </label>



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

                            'pl-10 pr-3.5'

                          )}

                          {...register(

                            'SoDienThoai'

                          )}

                        />

                      </div>



                      {errors.SoDienThoai && (

                        <p className="flex items-center gap-1 text-xs font-medium text-danger">

                          <i className="ph-fill ph-warning-circle" />

                          {

                            errors

                              .SoDienThoai

                              .message

                          }

                        </p>

                      )}

                    </div>



                    {/* PASSWORD */}

                    <div className="space-y-1.5">

                      <label

                        htmlFor="register-MatKhau"

                        className="block text-xs font-bold uppercase tracking-wide text-slate-700"

                      >

                        Mật khẩu

                        <span className="text-danger">

                          *

                        </span>

                      </label>



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

                          {...register(

                            'MatKhau'

                          )}

                        />



                        <button

                          type="button"

                          onClick={() =>

                            setShowPwd(

                              !showPwd

                            )

                          }

                          className="

                            absolute

                            right-3.5

                            top-1/2

                            -translate-y-1/2

                            text-slate-400

                            transition

                            hover:text-slate-800

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

                        <p className="flex items-center gap-1 text-xs font-medium text-danger">

                          <i className="ph-fill ph-warning-circle" />

                          {errors.MatKhau.message}

                        </p>

                      )}

                    </div>



                    {/* CONFIRM PASSWORD */}

                    <div className="space-y-1.5">

                      <label

                        htmlFor="register-confirmMatKhau"

                        className="block text-xs font-bold uppercase tracking-wide text-slate-700"

                      >

                        Xác nhận mật khẩu

                        <span className="text-danger">

                          *

                        </span>

                      </label>



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

                            transition

                            hover:text-slate-800

                          "

                          aria-label={

                            showConfirmPwd

                              ? 'Ẩn mật khẩu'

                              : 'Hiện mật khẩu'

                          }

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



                      {errors.confirmMatKhau && (

                        <p className="flex items-center gap-1 text-xs font-medium text-danger">

                          <i className="ph-fill ph-warning-circle" />

                          {

                            errors

                              .confirmMatKhau

                              .message

                          }

                        </p>

                      )}

                    </div>

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

                      p-4

                      transition

                      hover:bg-slate-100

                    "

                  >

                    <input

                      type="checkbox"

                      required

                      className="

                        mt-0.5

                        h-4

                        w-4

                        shrink-0

                        accent-blue-600

                      "

                    />



                    <span className="text-sm leading-6 text-slate-500">

                      Tôi đồng ý với{' '}

                      <span className="font-bold text-blue-600">

                        Điều khoản sử dụng

                      </span>{' '}

                      và{' '}

                      <span className="font-bold text-blue-600">

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



                  {/* LOGIN */}

                  <p className="text-center text-sm text-slate-500">

                    Đã có tài khoản?{' '}

                    <Link

                      to="/login"

                      className="

                        font-bold

                        text-blue-600

                        transition

                        hover:text-blue-700

                        hover:underline

                      "

                    >

                      Đăng nhập

                    </Link>

                  </p>

                </form>

              </div>

            )}

          </div>

        </div>

      </div>

    </div>

  );

}



/* =========================================================
   REGISTER FEATURE CARD
   Đồng bộ trực tiếp với card của Login
========================================================= */

interface RegisterFeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function RegisterFeatureCard({
  icon,
  title,
  description,
}: RegisterFeatureCardProps) {
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
        <i
          className={`ph ${icon} text-[26px]`}
          aria-hidden="true"
        />
      </div>

      <p
        className="
          text-[17px]
          font-extrabold
          !text-white
        "
      >
        {title}
      </p>

      <p
        className="
          mt-2
          text-[13px]
          font-medium
          leading-6
          !text-slate-200
        "
      >
        {description}
      </p>
    </div>
  );
}
