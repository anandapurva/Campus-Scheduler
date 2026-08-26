import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassEditor } from './class-editor';

describe('ClassEditor', () => {
  let component: ClassEditor;
  let fixture: ComponentFixture<ClassEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
