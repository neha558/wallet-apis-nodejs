import { Test, TestingModule } from '@nestjs/testing';
import { ThirdPartyApisService } from './third-party-apis.service';

describe('ThirdPartyApisService', () => {
  let service: ThirdPartyApisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThirdPartyApisService],
    }).compile();

    service = module.get<ThirdPartyApisService>(ThirdPartyApisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
