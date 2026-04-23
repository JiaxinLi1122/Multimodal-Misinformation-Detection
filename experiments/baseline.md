# Baseline Training Results

## Overview
This experiment records the initial training performance of the model without data augmentation.

---

## Experiment Info

- Date: 2026-04-22
- Experiment: Baseline (no augmentation)

---

## Training Metrics

| Epoch | Train Loss | Val Loss | Accuracy | Precision | Recall | F1 |
|------|-----------|----------|----------|-----------|--------|----|
| 1 | 0.312955 | 0.115317 | 96.78% | 98.37% | 95.89% | 97.12% |
| 2 | 0.158042 | 0.082540 | 97.98% | 98.92% | 97.48% | 98.20% |
| 3 | 0.143817 | 0.050328 | 99.25% | 99.34% | 99.34% | 99.34% |
| 4 | 0.096761 | **0.038174** | 99.25% | 99.34% | 99.34% | 99.34% |
| 5 | 0.093222 | 0.039103 | 99.55% | 99.87% | 99.34% | 99.60% |

---

## Best Model

- Selected epoch: **Epoch 4**
- Reason: Lowest validation loss (0.038174)

---

## Observations

- The model converges very quickly, reaching over 99% accuracy by epoch 3.
- Validation loss consistently decreases until epoch 4, then slightly increases at epoch 5.
- This indicates the beginning of **overfitting**.
- EarlyStopping mechanism is working correctly to prevent further degradation.

---

## Potential Issues

- Extremely high performance may indicate:
    - The dataset is relatively easy, OR
    - Possible data leakage between training and validation sets.

---

## Next Steps

- Apply data augmentation to improve generalization:
    - RandomHorizontalFlip
    - RandomRotation
    - ColorJitter
- Evaluate on a separate test set for more reliable performance estimation.
- Compare results with augmented training.

---

## Training Configuration

- Model: VGG19 + Transformer
- Epochs: 5
- Optimizer: Adam
- EarlyStopping: patience = 3