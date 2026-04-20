import { Test, TestingModule } from '@nestjs/testing';
import { SendEmailDto } from '../dto/send-email.dto';
import { NotificationService } from './notification.service';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn((..._args: unknown[]) => ({
  sendMail: mockSendMail,
}));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

const buildDto = (overrides: Partial<SendEmailDto> = {}): SendEmailDto => ({
  approverEmail: 'approver@test.com',
  equipo: 'payments',
  tipo: 'rs',
  descripcion: 'Cambios en checkout',
  prIdentifier: 'JIRA-123',
  motivoRechazo: 'Cobertura insuficiente: 50% (mínimo 80%)',
  releaseId: 'rel-abc-42',
  ...overrides,
});

describe('NotificationService - sendApprovalEmail()', () => {
  let service: NotificationService;

  beforeEach(async () => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('llama a sendMail con el approverEmail correcto como destinatario', async () => {
    await service.sendApprovalEmail(
      buildDto({ approverEmail: 'lead@payments.com' }),
    );

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.to).toBe('lead@payments.com');
  });

  it('el subject contiene el nombre del equipo', async () => {
    await service.sendApprovalEmail(buildDto({ equipo: 'platform-squad' }));

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.subject).toContain('platform-squad');
  });

  it('el subject contiene el releaseId', async () => {
    await service.sendApprovalEmail(buildDto({ releaseId: 'rel-xyz-999' }));

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.subject).toContain('rel-xyz-999');
  });

  it('el body HTML contiene el motivoRechazo', async () => {
    await service.sendApprovalEmail(
      buildDto({ motivoRechazo: 'Framework obsoleto: angular 10' }),
    );

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.html).toContain('Framework obsoleto: angular 10');
  });

  it('el body HTML contiene el equipo', async () => {
    await service.sendApprovalEmail(buildDto({ equipo: 'payments-team' }));

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.html).toContain('payments-team');
  });

  it('el body HTML contiene el tipo de release', async () => {
    await service.sendApprovalEmail(buildDto({ tipo: 'rs' }));

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.html).toContain('rs');
  });

  it('NO lanza excepción si sendMail falla (solo console.error)', async () => {
    mockSendMail.mockReset();
    mockSendMail.mockRejectedValue(new Error('SMTP unreachable'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(service.sendApprovalEmail(buildDto())).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalled();
    const [msg, err] = errSpy.mock.calls[0];
    expect(msg).toContain('Error enviando correo');
    expect(err).toBeInstanceOf(Error);

    errSpy.mockRestore();
  });

  it('retorna sin error aunque el transporter falle', async () => {
    mockSendMail.mockReset();
    mockSendMail.mockImplementation(() => {
      throw new Error('transporter exploded synchronously');
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(service.sendApprovalEmail(buildDto())).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('el body HTML escapa caracteres peligrosos (seguridad XSS)', async () => {
    await service.sendApprovalEmail(
      buildDto({
        descripcion: '<script>alert(1)</script>',
        motivoRechazo: 'bad & "quoted" <tag>',
      }),
    );

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.html).not.toContain('<script>alert(1)</script>');
    expect(mailOptions.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mailOptions.html).toContain('&amp;');
    expect(mailOptions.html).toContain('&quot;quoted&quot;');
  });

  it('sin prIdentifier muestra "—" en el HTML', async () => {
    await service.sendApprovalEmail(buildDto({ prIdentifier: undefined }));

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.html).toContain('—');
  });
});
