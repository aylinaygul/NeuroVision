import tensorflow as tf
import nibabel as nib
import numpy as np
import cv2
import matplotlib.pyplot as plt
from tensorflow.keras import backend as K
import os
import zipfile
import io
from flask import Flask, request, redirect, url_for, send_file
from werkzeug.utils import secure_filename

# Define Flask app and settings for file upload
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = './uploads'
app.config['ALLOWED_EXTENSIONS'] = {'zip'}

# Define the custom metrics
def dice_coef(y_true, y_pred, smooth=1.0):
    class_num = 4
    total_loss = 0
    for i in range(class_num):
        y_true_f = K.flatten(y_true[:, :, :, i])
        y_pred_f = K.flatten(y_pred[:, :, :, i])
        intersection = K.sum(y_true_f * y_pred_f)
        loss = (2. * intersection + smooth) / (K.sum(y_true_f) + K.sum(y_pred_f) + smooth)
        total_loss += loss
    total_loss /= class_num
    return total_loss

def dice_coef_necrotic(y_true, y_pred, epsilon=1e-6):
    intersection = K.sum(K.abs(y_true[:, :, :, 1] * y_pred[:, :, :, 1]))
    return (2. * intersection) / (K.sum(K.square(y_true[:, :, :, 1])) + K.sum(K.square(y_pred[:, :, :, 1])) + epsilon)

def dice_coef_edema(y_true, y_pred, epsilon=1e-6):
    intersection = K.sum(K.abs(y_true[:, :, :, 2] * y_pred[:, :, :, 2]))
    return (2. * intersection) / (K.sum(K.square(y_true[:, :, :, 2])) + K.sum(K.square(y_pred[:, :, :, 2])) + epsilon)

def dice_coef_enhancing(y_true, y_pred, epsilon=1e-6):
    intersection = K.sum(K.abs(y_true[:, :, :, 3] * y_pred[:, :, :, 3]))
    return (2. * intersection) / (K.sum(K.square(y_true[:, :, :, 3])) + K.sum(K.square(y_pred[:, :, :, 3])) + epsilon)

def precision(y_true, y_pred):
    true_positives = K.sum(K.round(K.clip(y_true * y_pred, 0, 1)))
    predicted_positives = K.sum(K.round(K.clip(y_pred, 0, 1)))
    return true_positives / (predicted_positives + K.epsilon())

def sensitivity(y_true, y_pred):
    true_positives = K.sum(K.round(K.clip(y_true * y_pred, 0, 1)))
    possible_positives = K.sum(K.round(K.clip(y_true, 0, 1)))
    return true_positives / (possible_positives + K.epsilon())

def specificity(y_true, y_pred):
    true_negatives = K.sum(K.round(K.clip((1-y_true) * (1-y_pred), 0, 1)))
    possible_negatives = K.sum(K.round(K.clip(1-y_true, 0, 1)))
    return true_negatives / (possible_negatives + K.epsilon())

# Load the model with the custom metrics
model = tf.keras.models.load_model('model_2019_350.h5',
                                   custom_objects={
                                       'dice_coef': dice_coef,
                                       'dice_coef_necrotic': dice_coef_necrotic,
                                       'dice_coef_edema': dice_coef_edema,
                                       'dice_coef_enhancing': dice_coef_enhancing,
                                       'precision': precision,
                                       'sensitivity': sensitivity,
                                       'specificity': specificity,
                                       'accuracy': tf.keras.metrics.MeanIoU(num_classes=4)
                                   }, compile=False)

def predictFromUploadedZip(zip_file):
    VOLUME_SLICES = 155  # You need to adjust this based on your data
    IMG_SIZE = 128  # Assuming your model expects 128x128 input images
    VOLUME_START_AT = 0  # Start slice index

    # Read the uploaded zip file
    with zipfile.ZipFile(zip_file, 'r') as z:
        # Extract all contents to a temporary directory
        z.extractall('temp_extracted')

    # Assuming files are extracted to 'temp_extracted' directory
    case_path = 'temp_extracted'

    files = os.listdir(case_path)
    X = np.empty((VOLUME_SLICES, IMG_SIZE, IMG_SIZE, 2))

    vol_path = os.path.join(case_path, f'flair.nii')
    flair = nib.load(vol_path).get_fdata()

    vol_path = os.path.join(case_path, f't1ce.nii')
    ce = nib.load(vol_path).get_fdata()

    for j in range(VOLUME_SLICES):
        X[j,:,:,0] = cv2.resize(flair[:,:,j+VOLUME_START_AT], (IMG_SIZE,IMG_SIZE))
        X[j,:,:,1] = cv2.resize(ce[:,:,j+VOLUME_START_AT], (IMG_SIZE,IMG_SIZE))

    # Make predictions
    predictions = model.predict(X / np.max(X), verbose=1)

    # Optionally, you can clean up the extracted files
    # os.remove(zip_file)
    # shutil.rmtree('temp_extracted')

    return predictions

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        # Check if the post request has the file part
        if 'file' not in request.files:
            return redirect(request.url)
        file = request.files['file']
        # If user does not select file, browser also
        # submit an empty part without filename
        if file.filename == '':
            return redirect(request.url)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            return redirect(url_for('uploaded_file', filename=filename))
    return '''
    <!doctype html>
    <title>Upload new File</title>
    <h1>Upload new File</h1>
    <form method=post enctype=multipart/form-data>
      <input type=file name=file>
      <input type=submit value=Upload>
    </form>
    '''

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    # Perform prediction and display results
    zip_file = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    return showPredictsByUploadedZip(zip_file)

def showPredictsByUploadedZip(zip_file, case='uploaded_case', start_slice=60):
    IMG_SIZE = 128
    SEGMENT_CLASSES = ['background', 'necrotic', 'edema', 'enhancing']

    # Predict using uploaded zip file
    predictions = predictFromUploadedZip(zip_file)

    core = predictions[:,:,:,1]
    edema = predictions[:,:,:,2]
    enhancing = predictions[:,:,:,3]

    plt.figure(figsize=(18, 50))
    f, axarr = plt.subplots(1, 6, figsize=(18, 50))

    # Example showing original image, ground truth, and predicted segments
    # Replace with your specific plot logic as needed
    for i in range(6):
        axarr[i].imshow(cv2.resize(X[:,:,start_slice], (IMG_SIZE, IMG_SIZE)), cmap="gray", interpolation='none')

    axarr[0].imshow(cv2.resize(X[:,:,start_slice], (IMG_SIZE, IMG_SIZE)), cmap="gray")
    axarr[0].title.set_text('Original image flair')
    # Example: plot ground truth
    # axarr[1].imshow(curr_gt, cmap="Reds", interpolation='none', alpha=0.3)
    # axarr[1].title.set_text('Ground truth')
    axarr[2].imshow(predictions[start_slice,:,:,1:4], cmap="Reds", interpolation='none', alpha=0.3)
    axarr[2].title.set_text('all classes')
    axarr[3].imshow(edema[start_slice,:,:], cmap="OrRd", interpolation='none', alpha=0.3)
    axarr[3].title.set_text(f'{SEGMENT_CLASSES[1]} predicted')
    axarr[4].imshow(core[start_slice,:,], cmap="OrRd", interpolation='none', alpha=0.3)
    axarr[4].title.set_text(f'{SEGMENT_CLASSES[2]} predicted')
    axarr[5].imshow(enhancing[start_slice,:,], cmap="OrRd", interpolation='none', alpha=0.3)
    axarr[5].title.set_text(f'{SEGMENT_CLASSES[3]} predicted')
    plt.savefig('Test_01.png')
    plt.show()

if __name__ == '__main__':
    app.run(debug=True)
