import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandyAdmin } from './candy-admin';

describe('CandyAdmin', () => {
  let component: CandyAdmin;
  let fixture: ComponentFixture<CandyAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandyAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(CandyAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
