import { TestBed } from '@angular/core/testing';

import { Program } from './program';

describe('Program', () => {
  let service: Program;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Program);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
