import { registerWebModule, NativeModule } from 'expo';

// En web usamos el proxy de Metro, así que este módulo no se usa.
class HtzHttpModule extends NativeModule<{}> {
  async getText(_url: string): Promise<string> {
    throw new Error('HtzHttp no está disponible en web');
  }
}

export async function getText(_url: string): Promise<string> {
  throw new Error('HtzHttp no está disponible en web');
}

export default registerWebModule(HtzHttpModule, 'HtzHttpModule');
