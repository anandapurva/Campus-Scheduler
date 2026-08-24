import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterData } from './master-data';

describe('MasterData', () => {
  let component: MasterData;
  let fixture: ComponentFixture<MasterData>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterData]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MasterData);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
