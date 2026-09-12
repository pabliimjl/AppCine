import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BienvenidaCine } from './bienvenida-cine';

describe('BienvenidaCine', () => {
  let component: BienvenidaCine;
  let fixture: ComponentFixture<BienvenidaCine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BienvenidaCine],
    }).compileComponents();

    fixture = TestBed.createComponent(BienvenidaCine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
