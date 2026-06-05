import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

type RepoMock = jest.Mocked<
  Pick<Repository<User>, 'create' | 'save' | 'findOne' | 'count'>
>;

describe('UsersService', () => {
  let service: UsersService;
  let repo: RepoMock;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    } as unknown as RepoMock;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('create() builds and persists a user', async () => {
    const input = { email: 'a@b.com', name: 'A', passwordHash: 'hash' };
    const entity = { id: 'u1', ...input } as User;
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    await expect(service.create(input)).resolves.toBe(entity);
    expect(repo.create).toHaveBeenCalledWith(input);
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('findByEmail() delegates to the repository', async () => {
    const user = { id: 'u1', email: 'a@b.com' } as User;
    repo.findOne.mockResolvedValue(user);

    await expect(service.findByEmail('a@b.com')).resolves.toBe(user);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
    });
  });

  it('existsByEmail() is true when count > 0', async () => {
    repo.count.mockResolvedValue(1);
    await expect(service.existsByEmail('a@b.com')).resolves.toBe(true);

    repo.count.mockResolvedValue(0);
    await expect(service.existsByEmail('x@y.com')).resolves.toBe(false);
  });
});
