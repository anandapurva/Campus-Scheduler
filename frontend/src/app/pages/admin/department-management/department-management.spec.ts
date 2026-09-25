import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepartmentManagement } from './department-management';

describe('DepartmentManagement', () => {
  let component: DepartmentManagement;
  let fixture: ComponentFixture<DepartmentManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepartmentManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepartmentManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
