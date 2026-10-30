import {hasPrintSupplements} from '@/services/book/readyBooks/publicationState';

it('shares digital-kit readiness without claiming provider or paper acceptance',()=>{
  expect(hasPrintSupplements({missing:['provider-acceptance','paper-check']})).toBe(true);
  for(const purpose of ['stickers','instructions','print-passport'] as const){
    expect(hasPrintSupplements({missing:['provider-acceptance',purpose]})).toBe(false);
  }
});
