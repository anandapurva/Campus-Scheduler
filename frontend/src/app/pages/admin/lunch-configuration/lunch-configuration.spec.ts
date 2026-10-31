import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LunchConfiguration } from './lunch-configuration';

describe('LunchConfiguration', () => {
  let component: LunchConfiguration;
  let fixture: ComponentFixture<LunchConfiguration>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LunchConfiguration]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LunchConfiguration);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
