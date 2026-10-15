import { ProfileRepository } from './profile.repository';
import { PartnersRepository } from '../partners/partners.repository';
import { AppError } from '../../common/errors/app-error';
import { toSafeAccount, SafeAccount } from '../../common/utils/account-mapper';
import type { UpdateProfileInput } from './profile.schemas';

export class ProfileService {
  constructor(
    private readonly profileRepository: ProfileRepository = new ProfileRepository(),
    private readonly partnersRepository: PartnersRepository = new PartnersRepository()
  ) {}

  async getMe(maTaiKhoan: number): Promise<SafeAccount> {
    const account = await this.profileRepository.findById(maTaiKhoan);
    if (!account) throw AppError.notFound('Tài khoản không tồn tại');
    const flags = await this.partnersRepository.getApplicationFlags(maTaiKhoan);
    return { ...toSafeAccount(account), DangChoDuyetDoiTac: flags.pending, HoSoDoiTacBiTuChoi: flags.rejected };
  }

  async updateMe(maTaiKhoan: number, input: UpdateProfileInput): Promise<SafeAccount> {
    const account = await this.profileRepository.findById(maTaiKhoan);
    if (!account) throw AppError.notFound('Tài khoản không tồn tại');

    const updated = await this.profileRepository.update(maTaiKhoan, {
      ...input,
      NgayCapNhat: new Date(),
    });
    const flags = await this.partnersRepository.getApplicationFlags(maTaiKhoan);
    return { ...toSafeAccount(updated), DangChoDuyetDoiTac: flags.pending, HoSoDoiTacBiTuChoi: flags.rejected };
  }
}
