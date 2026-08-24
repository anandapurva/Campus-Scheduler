import { TestBed } from '@angular/core/testing';

import { Timetable } from './timetable';

describe('Timetable', () => {
  let service: Timetable;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Timetable);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
