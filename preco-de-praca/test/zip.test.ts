import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extrairZip } from '../src/cli/baixar-icp.ts';

describe('extrairZip', () => {
  it('extrai arquivos comprimidos e armazenados', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    writeFileSync(join(dir, 'a.crt'), 'certificado A '.repeat(50));
    writeFileSync(join(dir, 'b.cer'), 'B');
    execFileSync('python3', ['-I', '-c', `import zipfile,os;z=zipfile.ZipFile('${dir}/t.zip','w');z.write('${dir}/a.crt','pasta/a.crt',zipfile.ZIP_DEFLATED);z.write('${dir}/b.cer','b.cer',zipfile.ZIP_STORED);z.close()`]);
    const arquivos = extrairZip(readFileSync(join(dir, 't.zip')));
    expect(arquivos.map(a => [a.nome, a.dados.toString()])).toEqual([['pasta/a.crt', 'certificado A '.repeat(50)], ['b.cer', 'B']]);
  });
});
