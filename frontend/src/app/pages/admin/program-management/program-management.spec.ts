import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgramManagement } from './program-management';

describe('ProgramManagement', () => {
  let component: ProgramManagement;
  let fixture: ComponentFixture<ProgramManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgramManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProgramManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
