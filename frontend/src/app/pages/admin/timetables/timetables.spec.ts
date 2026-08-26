import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Timetables } from './timetables';

describe('Timetables', () => {
  let component: Timetables;
  let fixture: ComponentFixture<Timetables>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Timetables]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Timetables);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
