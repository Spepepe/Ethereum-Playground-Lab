import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RootModule } from './root/root.module';
import { DidModule } from './did/did.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RootModule,
    DidModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
