import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Uploads } from './uploads';

describe('Uploads', () => {
  let component: Uploads;
  let fixture: ComponentFixture<Uploads>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Uploads]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Uploads);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
