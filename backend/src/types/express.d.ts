import { User, TokenPayload } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: TokenPayload;
    }
  }
}

export {};
