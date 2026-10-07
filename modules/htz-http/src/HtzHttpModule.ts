import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class HtzHttpModule extends NativeModule<{}> {
  getText(url: string): Promise<string>;
}

const HtzHttp = requireOptionalNativeModule<HtzHttpModule>('HtzHttp');

/** GET de texto (Android). Lanza si el módulo no está disponible o hay error HTTP. */
export async function getText(url: string): Promise<string> {
  if (!HtzHttp) throw new Error('HtzHttp no disponible');
  return HtzHttp.getText(url);
}

export default HtzHttp;
