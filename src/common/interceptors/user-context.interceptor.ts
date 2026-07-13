import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { userContext } from '../context/user-context';

@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || 'system';

    return new Observable((subscriber) => {
      userContext.run({ userId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
