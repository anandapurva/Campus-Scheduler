import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcademicSessionManagement } from './academic-session-management';

describe('AcademicSessionManagement', () => {
  let component: AcademicSessionManagement;
  let fixture: ComponentFixture<AcademicSessionManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcademicSessionManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcademicSessionManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
