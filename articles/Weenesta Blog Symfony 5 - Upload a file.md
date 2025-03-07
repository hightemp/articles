# Weenesta | Blog | Symfony 5 - Upload a file
![](symfony.png)

Hello,

I would like to show you how to **upload** very simply **a file** with the framework **Symfony 5**, without any Bundle.

To properly structure our actions, we will create and configure:

1.  A **service** allowing you to upload any type of file to a specific directory,
2.  A **form** allowing to apply restrictions on the file to upload,
3.  A **controller** allowing to manage all the actions,
4.  A **view** allowing to define the web interface.

Service creation and configuration
----------------------------------

Let's create the code of a service that will allow the upload of any type of file, without restriction:

```


1.  `// src/Service/FileUploader.php`
2.  `namespace  App\Service;`

4.  `use  Symfony\Component\HttpFoundation\File\Exception\FileException;`
5.  `use  Symfony\Component\HttpFoundation\File\UploadedFile;`
6.  `use  Symfony\Component\String\Slugger\SluggerInterface;`

8.  `class  FileUploader`
9.  `{`
10.   `private $targetDirectory;`
11.   `private $slugger;`

13.   `public  function __construct($targetDirectory,  SluggerInterface $slugger)`
14.   `{`
15.   `$this->targetDirectory = $targetDirectory;`
16.   `$this->slugger = $slugger;`
17.   `}`

19.   `public  function upload(UploadedFile $file)`
20.   `{`
21.   `$originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);`
22.   `$safeFilename = $this->slugger->slug($originalFilename);`
23.   `$fileName = $safeFilename.'-'.uniqid().'.'.$file->guessExtension();`

25.   `try  {`
26.   `$file->move($this->getTargetDirectory(), $fileName);`
27.   `}  catch  (FileException $e)  {`
28.   `// ... handle exception if something happens during file upload`
29.   `return  null;  // for example`
30.   `}`

32.   `return $fileName;`
33.   `}`

35.   `public  function getTargetDirectory()`
36.   `{`
37.   `return $this->targetDirectory;`
38.   `}`
39.  `}`


```

You must then configure this service, in particular by passing it the directory where all uploaded files will be stored.

```


1.  `# config/services.yaml`

3.  `parameters:`
4.   `upload_directory:  '%kernel.project_dir%/public/uploads'`
5.  `#...`

7.  `services:`
8.   `# ...`
9.   `App\Service\FileUploader:`
10.   `arguments:`
11.   `$targetDirectory:  '%upload_directory%'`


```

Snippets issued from [Framework documentation](https://symfony.com/doc/current/controller/upload_file.html#creating-an-uploader-service).

Form creation and configuration
-------------------------------

This is where we will decide which types of file mimes we want to upload:

```


1.  `<?php`
2.  `// src/Form/FileUploadType.php`
3.  `namespace  App\Form;`

5.  `use  Symfony\Component\Form\AbstractType;`
6.  `use  Symfony\Component\Form\Extension\Core\Type\FileType;`
7.  `use  Symfony\Component\Form\Extension\Core\Type\SubmitType;`
8.  `use  Symfony\Component\Form\FormBuilderInterface;`
9.  `use  Symfony\Component\OptionsResolver\OptionsResolver;`
10.  `use  Symfony\Component\Validator\Constraints\File;`

12.  `class  FileUploadType  extends  AbstractType`
13.  `{`
14.   `public  function buildForm(FormBuilderInterface $builder, array $options)`
15.   `{`
16.   `$builder`
17.   `->add('upload_file',  FileType::class,  [`
18.   `'label'  =>  false,`
19.   `'mapped'  =>  false,  // Tell that there is no Entity to link`
20.   `'required'  =>  true,`
21.   `'constraints'  =>  [`
22.   `new  File([` 
23.   `'mimeTypes'  =>  [  // We want to let upload only txt, csv or Excel files`
24.   `'text/x-comma-separated-values',` 
25.   `'text/comma-separated-values',` 
26.   `'text/x-csv',` 
27.   `'text/csv',` 
28.   `'text/plain',`
29.   `'application/octet-stream',` 
30.   `'application/vnd.ms-excel',` 
31.   `'application/x-csv',` 
32.   `'application/csv',` 
33.   `'application/excel',` 
34.   `'application/vnd.msexcel',` 
35.   `'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`
36.   `],`
37.   `'mimeTypesMessage'  =>  "This document isn't valid.",`
38.   `])`
39.   `],`
40.   `])`
41.   `->add('send',  SubmitType::class);  // We could have added it in the view, as stated in the framework recommendations`
42.   `}`
43.  `}`


```

You will find on [Mozilla developper documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types) tous les types mimes possibles.

Controller creation
-------------------

This controller allows to validate the file mime type and to upload with the service that we have created. We could for example explore the content of the file or parse it, but this might be another Blog post!

```


2.  `namespace  App\Controller;`

4.  `use  Symfony\Bundle\FrameworkBundle\Controller\AbstractController;`
5.  `use  Symfony\Component\HttpFoundation\Request;`

7.  `use  App\Service\FileUploader;`
8.  `use  App\Form\FileUploadType;`

10.  `class  UploadController  extends  BaseController`
11.  `{`
12.   `// ...`

14.   `/**`
15.   `* @Route("/test-upload", name="app_test_upload")`
16.   `*/`
17.   `public  function excelCommunesAction(Request $request,  FileUploader $file_uploader)`
18.   `{`
19.   `$form = $this->createForm(FileUploadType::class);`
20.   `$form->handleRequest($request);`

22.   `if  ($form->isSubmitted()  && $form->isValid())` 
23.   `{`
24.   `$file = $form['upload_file']->getData();`
25.   `if  ($file)` 
26.   `{`
27.   `$file_name = $file_uploader->upload($file);`
28.   `if  (null  !== $file_name)  // for example`
29.   `{`
30.   `$directory = $file_uploader->getTargetDirectory();`
31.   `$full_path = $directory.'/'.$file_name;`
32.   `// Do what you want with the full path file...`
33.   `// Why not read the content or parse it !!!`
34.   `}`
35.   `else`
36.   `{`
37.   `// Oups, an error occured !!!`
38.   `}`
39.   `}`
40.   `}`

42.   `return $this->render('app/test-upload.html.twig',  [`
43.   `'form'  => $form->createView(),`
44.   `]);`
45.   `}`

47.   `// ...`
48.  `}`


```

View creation
-------------

This view will display our recently created form:

```


1.  `{# templates/app/test-upload.html.twig #}`
2.  `{%  extends  'app/layout.html.twig'  %}`

4.  `{% block title %}Upload test{% endblock %}`
5.  `{% block description %}This page will render a simple form to upload a file.{% endblock %}`

7.  `{% block content %}`
8.   `<div class="container container-fluid">`
9.   `<div class="row">`
10.   `<div class="col-lg-8">`
11.   `{{ form_start(form,  { attr:  {  'accept-charset'  :  'utf-8'  }})  }}`
12.   `<div class="form-group">`
13.   `{{ form_label(form.upload_file)  }}`
14.   `{{ form_widget(form.upload_file)  }}`
15.   `{{ form_errors(form.upload_file)  }}`
16.   `</div>`
17.   `<div class="form-group">`
18.   `{{ form_widget(form.send,  {'label':  "Upload this file",  'attr'  :  {  'class':  'btn btn-primary'  }})  }}`
19.   `</div>`
20.   `{{ form_rest(form)  }}`
21.   `{{ form_end(form)  }}`
22.   `</div>`
23.   `</div>`
24.   `</div>`
25.  `{% endblock %}`


```

There you go, you now know how to upload a file without any third party bundle !!!

See you soon,

Mathieu