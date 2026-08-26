import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubjectManagement } from './subject-management';

describe('SubjectManagement', () => {
  let component: SubjectManagement;
  let fixture: ComponentFixture<SubjectManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubjectManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubjectManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
