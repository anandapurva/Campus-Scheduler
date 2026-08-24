import { TestBed } from '@angular/core/testing';

import { Faculty } from './faculty';

describe('Faculty', () => {
  let service: Faculty;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Faculty);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
